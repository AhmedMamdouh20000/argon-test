import json
import wave
from pathlib import Path
import av
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "demo_work" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_DIR = Path(r"C:\Users\Mobi lap\.gemini\antigravity\brain\9e075e6e-5fed-48ba-b895-bab32aa694af\.user_uploaded")
src_files = list(UPLOAD_DIR.glob("*.mp3"))
if not src_files:
    raise FileNotFoundError("لم يتم العثور على ملف الصوت المرفوع")
SRC_MP3 = src_files[0]

print(f"🎙️ قراءة ملف الصوت المرفوع: {SRC_MP3}")

# فك ضغط ملف الصوت بالكامل إلى مصفوفة NumPy بمعدل 44100Hz Stereo
container = av.open(str(SRC_MP3))
resampler = av.AudioResampler(format="s16", layout="stereo", rate=44100)

chunks = []
for frame in container.decode(audio=0):
    for rframe in resampler.resample(frame):
        arr = rframe.to_ndarray()  # shape: (1, samples*2) or (2, samples)
        if arr.ndim == 2 and arr.shape[0] == 2:
            arr = arr.T  # (samples, 2)
        else:
            arr = arr.reshape(-1, 2)
        chunks.append(arr)

for rframe in resampler.resample(None):
    arr = rframe.to_ndarray()
    if arr.ndim == 2 and arr.shape[0] == 2:
        arr = arr.T
    else:
        arr = arr.reshape(-1, 2)
    chunks.append(arr)

pcm = np.concatenate(chunks, axis=0)  # shape: (total_samples, 2), dtype=int16
SR = 44100
total_sec = len(pcm) / SR
print(f"✅ طول الصوت الكلي: {total_sec:.2f} ثانية")

# حساب مستوى الصوت (RMS) في نوافذ 50ms لاكتشاف فواصل الصمت بدقة
win_size = int(0.05 * SR)
num_wins = len(pcm) // win_size
mono = pcm[: num_wins * win_size].astype(np.float32).mean(axis=1).reshape(num_wins, win_size)
rms = np.sqrt(np.mean(mono ** 2, axis=1))
db = 20 * np.log10(np.maximum(rms, 1.0) / 32768.0)

is_silent = db < -35.0
silences = []
in_sil = False
sil_start = 0
for i, s in enumerate(is_silent):
    t = i * 0.05
    if s and not in_sil:
        in_sil = True
        sil_start = t
    elif not s and in_sil:
        in_sil = False
        dur = t - sil_start
        if dur >= 0.9:
            silences.append((round(sil_start, 2), round(t, 2), round(dur, 2)))
if in_sil:
    dur = total_sec - sil_start
    if dur >= 0.4:
        silences.append((round(sil_start, 2), round(total_sec, 2), round(dur, 2)))

print("🔍 فواصل الصمت المكتشفة (>= 0.9s):", silences)

# أخذ أطول 11 فاصل صمت بين الـ 12 جملة (بالإضافة لأي صمت في البداية/النهاية)
internal_silences = [s for s in silences if s[0] > 0.5 and s[1] < total_sec - 0.5]
internal_silences.sort(key=lambda x: x[2], reverse=True)
top_11 = sorted(internal_silences[:11], key=lambda x: x[0])

segments = []
cur_start = 0.0
for st, en, _ in top_11:
    # نترك هامش صمت صغير جداً (0.08s) في بداية ونهاية كل جملة لعدم قطع الحروف
    seg_s = max(0.0, cur_start - 0.05) if cur_start > 0 else 0.0
    seg_e = min(total_sec, st + 0.12)
    segments.append((round(seg_s, 3), round(seg_e, 3)))
    cur_start = en

segments.append((round(max(0.0, cur_start - 0.05), 3), round(total_sec, 3)))

print(f"✅ تم تقسيم الصوت إلى {len(segments)} جملة بالظبط:")
scene_ids = [f"s{i}" for i in range(1, 13)]
meta = []

for sid, (st, en) in zip(scene_ids, segments):
    s_idx = int(st * SR)
    e_idx = int(en * SR)
    clip = pcm[s_idx:e_idx]
    dur = round((e_idx - s_idx) / SR, 3)
    out_wav = AUDIO_DIR / f"{sid}.wav"
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(clip.tobytes())
    print(f"  - {sid}: من {st:6.2f}s إلى {en:6.2f}s (المدة: {dur:5.2f}s)")
    meta.append({"id": sid, "file": str(out_wav), "start_in_source": st, "end_in_source": en, "duration": dur})

(AUDIO_DIR / "audio_meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
