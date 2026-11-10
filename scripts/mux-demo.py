import json
import wave
from fractions import Fraction
from pathlib import Path
import av
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
WORK_DIR = ROOT / "demo_work"
FRAMES_DIR = WORK_DIR / "frames"
AUDIO_DIR = WORK_DIR / "audio"
FINAL_MP4 = ROOT / "mukhattati-demo.mp4"
ADHAN_MP3 = ROOT / "assets" / "adhan.mp3"

SR = 44100
FPS = 60


def decode_audio_stereo_s16(file_path: Path) -> np.ndarray:
    container = av.open(str(file_path))
    resampler = av.AudioResampler(format="s16", layout="stereo", rate=SR)
    chunks = []
    for frame in container.decode(audio=0):
        for rf in resampler.resample(frame):
            arr = rf.to_ndarray()
            arr = arr.T if (arr.ndim == 2 and arr.shape[0] == 2) else arr.reshape(-1, 2)
            chunks.append(arr)
    for rf in resampler.resample(None):
        arr = rf.to_ndarray()
        arr = arr.T if (arr.ndim == 2 and arr.shape[0] == 2) else arr.reshape(-1, 2)
        chunks.append(arr)
    container.close()
    return np.concatenate(chunks, axis=0).astype(np.float32)


def read_wav_stereo(wav_path: Path) -> np.ndarray:
    with wave.open(str(wav_path), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
    return np.frombuffer(raw, dtype=np.int16).reshape(-1, 2).astype(np.float32)


def build_audio_mix(total_dur: float, scene_starts: dict) -> np.ndarray:
    total_samples = int(round(total_dur * SR)) + SR
    mix = np.zeros((total_samples, 2), dtype=np.float32)

    # 1) إضافة مقاطع التعليق الصوتي الـ 12 في مواعيدها بالظبط (+0.3s من بداية كل مشهد)
    for i in range(1, 13):
        sid = f"s{i}"
        wav_path = AUDIO_DIR / f"{sid}.wav"
        if not wav_path.exists():
            continue
        clip = read_wav_stereo(wav_path)
        start_sec = float(scene_starts.get(sid, 0.0)) + 0.3
        s_idx = int(round(start_sec * SR))
        e_idx = min(total_samples, s_idx + len(clip))
        if e_idx > s_idx:
            mix[s_idx:e_idx] += clip[: e_idx - s_idx] * 1.15

    # 2) إضافة صوت الأذان تحت مشهد s8 بمستوى هادي (~0.16) مع fade-in و fade-out قبل s9
    if ADHAN_MP3.exists() and "s8" in scene_starts and "s9" in scene_starts:
        adhan_pcm = decode_audio_stereo_s16(ADHAN_MP3)
        s8_start = float(scene_starts["s8"])
        s9_start = float(scene_starts["s9"])
        s8_dur = max(4.0, s9_start - s8_start - 0.3)
        target_len = min(len(adhan_pcm), int(round(s8_dur * SR)))
        adhan_clip = adhan_pcm[:target_len].copy() * 0.16

        fade_in_len = min(target_len // 4, int(0.6 * SR))
        fade_out_len = min(target_len // 3, int(1.6 * SR))
        if fade_in_len > 0:
            adhan_clip[:fade_in_len] *= np.linspace(0.0, 1.0, fade_in_len, dtype=np.float32)[:, None]
        if fade_out_len > 0:
            adhan_clip[-fade_out_len:] *= np.linspace(1.0, 0.0, fade_out_len, dtype=np.float32)[:, None]

        s_idx = int(round(s8_start * SR))
        e_idx = min(total_samples, s_idx + target_len)
        if e_idx > s_idx:
            mix[s_idx:e_idx] += adhan_clip[: e_idx - s_idx]

    # قص على الطول الفعلي بالظبط + Soft limiter لمنع أي clipping
    exact_samples = int(round(total_dur * SR))
    mix = mix[:exact_samples]
    peak = np.max(np.abs(mix))
    if peak > 30000.0:
        mix *= 30000.0 / peak
    return np.clip(mix, -32767, 32767).astype(np.int16)


def main():
    manifest_info = json.loads((WORK_DIR / "scene_times.json").read_text(encoding="utf-8"))
    scene_starts = manifest_info["sceneStartTimes"]
    total_dur = float(manifest_info["totalDuration"])
    frames_manifest = manifest_info["framesManifest"]

    print(f"🎚️ بناء المكساج الصوتي الكامل (المدة: {total_dur:.2f}s)...")
    audio_pcm = build_audio_mix(total_dur, scene_starts)

    print(f"🎞️ تشفير الفيديو والصوت إلى {FINAL_MP4} (2560×1440 @ 60fps H.264 + AAC 192k)...")
    out = av.open(str(FINAL_MP4), mode="w")

    v_stream = out.add_stream("libx264", rate=FPS)
    v_stream.width = 2560
    v_stream.height = 1440
    v_stream.pix_fmt = "yuv420p"
    v_stream.time_base = Fraction(1, FPS)
    v_stream.options = {"crf": "19", "preset": "ultrafast"}

    a_stream = out.add_stream("aac", rate=SR)
    a_stream.layout = "stereo"
    a_stream.bit_rate = 192000
    a_stream.time_base = Fraction(1, SR)

    # تمرير الفريمات بجدول زمني 60fps ثابت (CFR 60/1)
    target_total_frames = int(round(total_dur * FPS))
    acc_time = 0.0
    emitted_frames = 0

    for item in frames_manifest:
        jpg_path = FRAMES_DIR / item["file"]
        dur = float(item["duration"])
        acc_time += dur
        target_up_to_now = min(target_total_frames, int(round(acc_time * FPS)))
        repeat_count = max(1, target_up_to_now - emitted_frames)

        img_container = av.open(str(jpg_path))
        vframe = next(img_container.decode(video=0))
        img_container.close()
        rgb_arr = vframe.to_ndarray(format="rgb24")

        for _ in range(repeat_count):
            new_vf = av.VideoFrame.from_ndarray(rgb_arr, format="rgb24").reformat(
                width=2560, height=1440, format="yuv420p"
            )
            new_vf.pts = emitted_frames
            new_vf.time_base = Fraction(1, FPS)
            for pkt in v_stream.encode(new_vf):
                out.mux(pkt)
            emitted_frames += 1

    for pkt in v_stream.encode(None):
        out.mux(pkt)

    # تشفير الصوت على دفعات 1024 عينة
    chunk_len = 1024
    pts = 0
    for start in range(0, len(audio_pcm), chunk_len):
        sub = audio_pcm[start : start + chunk_len]
        # PyAV s16 packed stereo expects shape (1, samples * 2)
        packed = sub.reshape(1, -1)
        aframe = av.AudioFrame.from_ndarray(packed, format="s16", layout="stereo")
        aframe.sample_rate = SR
        aframe.pts = pts
        pts += len(sub)
        for pkt in a_stream.encode(aframe):
            out.mux(pkt)

    for pkt in a_stream.encode(None):
        out.mux(pkt)

    out.close()

    # فحص الملف الناتج واستخراج لقطات الفحص البصري (QA)
    qa_dir = WORK_DIR / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    verify = av.open(str(FINAL_MP4))
    vs = verify.streams.video[0]
    aus = verify.streams.audio[0]
    print(
        f"✅ فحص الفيديو الناتج: {vs.codec_context.name} {vs.width}x{vs.height} @ {vs.average_rate} fps | "
        f"مدة الفيديو: {float(vs.duration * vs.time_base):.2f}s | "
        f"مدة الصوت: {float(aus.duration * aus.time_base):.2f}s"
    )

    picks = {
        "intro": 2.0,
        "s3": scene_starts["s3"] + 2.2,
        "s4": scene_starts["s4"] + 2.8,
        "s7": scene_starts["s7"] + 2.4,
        "s8": scene_starts["s8"] + 2.5,
        "s9": scene_starts["s9"] + 4.8,
        "s11": scene_starts["s11"] + 2.45,
        "outro": total_dur - 2.0,
    }
    for name, sec in picks.items():
        verify.seek(int(sec * av.time_base))
        for frame in verify.decode(video=0):
            if float(frame.pts * vs.time_base) >= sec - 0.1:
                out_jpg = av.open(str(qa_dir / f"{name}.jpg"), "w")
                s_jpg = out_jpg.add_stream("mjpeg", rate=1)
                s_jpg.width = frame.width
                s_jpg.height = frame.height
                s_jpg.pix_fmt = "yuvj420p"
                for p in s_jpg.encode(frame.reformat(format="yuvj420p")):
                    out_jpg.mux(p)
                for p in s_jpg.encode(None):
                    out_jpg.mux(p)
                out_jpg.close()
                break
    verify.close()
    print("🎉 اكتمل تجميع الفيديو وفحصه بنجاح!")


if __name__ == "__main__":
    main()
