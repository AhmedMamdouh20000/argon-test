import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT_JSON = ROOT / "script.json"
OUT_DIR = ROOT / "demo_work" / "audio"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FFPROBE = ROOT / "node_modules" / "ffprobe-static" / "bin" / "win32" / "x64" / "ffprobe.exe"
FFMPEG = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

# النصوص بالتشكيل المضبوط لتحسين النطق العربي في الـ TTS المحلي
VOCALIZED_SAY = {
    "s1": "أَهْلًا بِيكْ. دَه مُخَطَّطِي، مُخَطَّطْ يَوْمِيّ بِالْعَرَبِي، فِيهِ الْمَهَامّ وَالصَّلَاة وَالْفُلُوسْ. تَعَالَى نِجَرَّبُه سَوَا.",
    "s2": "أَوَّلْ مَا تِفْتَحْ، بِتِخْتَارْ تِحْفَظْ بَيَانَاتَكْ عَلَى جِهَازَكْ بَسْ، أَوْ تِسَجَّلْ بِجُوجِلْ وَتِتْزَامِنْ بَيْن كُلّ أَجْهِزْتَكْ. هَنِخْتَارْ الْجِهَازْ.",
    "s3": "دَه قَوْسُ الْيَوْمْ. الشَّمْسُ بِتِتْحَرَّكْ بَيْنَ الصَّلَوَاتِ الْخَمْسْ، وَالسَّمَا بِتِتْغَيَّرْ مِنَ الْفَجْرِ لِلْعِشَا، وَتَحْتِيهَا عَدٌّ تَنَازُلِيٌّ لِلصَّلَاةِ الْجَايَّة.",
    "s4": "عَشَانْ تِضِيفْ مُهِمَّة، اِكْتِبْهَا بِجُمْلَة عَادِيَّة. هَنِكْتِبْ: مُذَاكَرَة السَّاعَة حِدَاشَرْ وَخَمْسِينْ. وَالتَّطْبِيقْ بِيِفْهَمْ الْوَقْتْ لِوَحْدُه.",
    "s5": "وَكَمَانْ هَنِكْتِبْ: اِجْتِمَاعْ بُكْرَة خَمْسَة مَسَاءً، فَبِيِرُوحْ لِبُكْرَة تِلْقَائِيًّا.",
    "s6": "عَلَّمْ الْمُهِمَّة إِنَّهَا تَمَّتْ، وَشُوفْ دَايْرَة الْإِنْجَازْ وَهِيَّ بِتِتْحَرَّكْ، وَالنِّسْبَة اللِّي خَلَّصْتَهَا وَالْبَاقِي.",
    "s7": "قَبْلَ الْمُهِمَّة بِرُبْعِ سَاعَة، بِيِطْلَعْلَكْ مُنَبِّهْ يِفَكَّرَكْ. وَتِقْدَرْ تَأَجِّلْهَا أَوْ تِعَلِّمْهَا تَمَّتْ.",
    "s8": "وَلَمَّا يَحِينْ وَقْتُ الصَّلَاة، بِيِشْتَغَلْ الْأَذَانْ وَيَظْهَرْ حِوَارْ لَازِمْ تِجَاوِبْ عَلِيهْ. مَفِيشْ اِخْتِصَارْ. لَازِمْ تِخْتَارْ: وَاللّٰهِ صَلَّيْتْ، أَوْ وَاللّٰهِ هَصَلِّي.",
    "s9": "فِي تَبْوِيبِ الْفُلُوسْ، اِكْتِبْ مُرَتَّبَكْ وَمُوَاصَلَاتَكْ الْيَوْمِيَّة، وَضِيفْ اِحْتِيَاجَاتَكْ الشَّهْرِيَّة، وَالتَّطْبِيقْ يِحْسِبْ تِصْرِفْ كَامْ فِي الْيَوْمْ. وَالِادِّخَارْ اِخْتِيَارِيّ.",
    "s10": "وَفِي لَوْحَتِي، تِلَاقِي تَقْرِيرَ الْيَوْمْ: كَامْ مُهِمَّة اِتْعَمَلِتْ، وَكَامْ اِتْأَجَّلِتْ.",
    "s11": "وَتِقْدَرْ تِبَدِّلْ بَيْنَ الْوَضْعِ الْفَاتِحْ وَالدَّاكِنْ، بِدَايْرَة بِتِتْوَسَّعْ مِنْ مَكَانْ ضَغْطِتَكْ.",
    "s12": "دَه مُخَطَّطِي. شَغَّالْ عَلَى الْمُوبَايِلْ وَاللَّابْ. جَرَّبُه مِنَ الرَّابِطْ، وَبِالتَّوْفِيقْ."
}


def get_duration(file_path: Path) -> float:
    cmd = [
        str(FFPROBE),
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(file_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return round(float(res.stdout.strip()), 3)


def ensure_piper_model() -> Path:
    model_dir = ROOT / "demo_work" / "piper_model"
    model_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = model_dir / "ar_JO-kareem-medium.onnx"
    json_path = model_dir / "ar_JO-kareem-medium.onnx.json"
    if not onnx_path.exists() or not json_path.exists():
        import urllib.request
        base_url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/medium/"
        print("⬇️ جاري تحميل موديل الصوت العربي ar_JO-kareem-medium (Piper TTS)...")
        urllib.request.urlretrieve(base_url + "ar_JO-kareem-medium.onnx", onnx_path)
        urllib.request.urlretrieve(base_url + "ar_JO-kareem-medium.onnx.json", json_path)
    return onnx_path


def synth_with_piper(onnx_path: Path, text: str, out_wav: Path):
    from piper.voice import PiperVoice
    import wave
    if not hasattr(synth_with_piper, "_voice"):
        synth_with_piper._voice = PiperVoice.load(str(onnx_path))
    with wave.open(str(out_wav), "wb") as wf:
        synth_with_piper._voice.synthesize_wav(text, wf)


def main():
    data = json.loads(SCRIPT_JSON.read_text(encoding="utf-8"))
    scenes = data["scenes"]

    # لو المستخدم مرر ملف ElevenLabs جاهز كـ argument أول، نقطعه بـ silencedetect
    if len(sys.argv) > 1 and Path(sys.argv[1]).exists():
        src_mp3 = Path(sys.argv[1])
        print(f"🎙️ استخدام ملف ElevenLabs المقدم: {src_mp3}")
        detect_cmd = [
            str(FFMPEG), "-i", str(src_mp3),
            "-af", "silencedetect=noise=-30dB:d=0.6",
            "-f", "null", "-"
        ]
        res = subprocess.run(detect_cmd, capture_output=True, text=True)
        # استخراج الفواصل الأطول من 1.8 ثانية
        import re
        starts = [float(x) for x in re.findall(r"silence_start:\s*([0-9.]+)", res.stderr)]
        ends = [float(x) for x in re.findall(r"silence_end:\s*([0-9.]+)", res.stderr)]
        splits = []
        for st, en in zip(starts, ends):
            if (en - st) >= 1.8:
                splits.append((st, en))
        total_dur = get_duration(src_mp3)
        segments = []
        cur_t = 0.0
        for st, en in splits:
            if st - cur_t > 0.3:
                segments.append((cur_t, st))
            cur_t = en
        if total_dur - cur_t > 0.3:
            segments.append((cur_t, total_dur))

        print(f"تم العثور على {len(segments)} جملة صوتية.")
        meta = []
        for idx, sc in enumerate(scenes):
            sid = sc["id"]
            out_wav = OUT_DIR / f"{sid}.wav"
            st, en = segments[idx]
            subprocess.run([
                str(FFMPEG), "-y", "-i", str(src_mp3),
                "-ss", str(st), "-to", str(en),
                "-ar", "44100", "-ac", "2", str(out_wav)
            ], check=True, capture_output=True)
            dur = get_duration(out_wav)
            meta.append({"id": sid, "file": str(out_wav), "duration": dur})
        (OUT_DIR / "audio_meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        return

    # البديل المحلي المعتمد في الخطة: Piper TTS (ar_JO-kareem-medium)
    onnx_path = ensure_piper_model()
    meta = []
    for sc in scenes:
        sid = sc["id"]
        raw_wav = OUT_DIR / f"{sid}_raw.wav"
        out_wav = OUT_DIR / f"{sid}.wav"
        text = VOCALIZED_SAY.get(sid, sc["say"])
        synth_with_piper(onnx_path, text, raw_wav)
        # تحويل إلى 44100Hz Stereo نظيف
        subprocess.run([
            str(FFMPEG), "-y", "-i", str(raw_wav),
            "-af", "aresample=44100,pan=stereo|c0=c0|c1=c0",
            "-ar", "44100", "-ac", "2", str(out_wav)
        ], check=True, capture_output=True)
        raw_wav.unlink(missing_ok=True)
        dur = get_duration(out_wav)
        print(f"✅ {sid}: {dur:.2f}s — {sc['cap']}")
        meta.append({"id": sid, "file": str(out_wav), "duration": dur})

    (OUT_DIR / "audio_meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print("🎉 اكتمل توليد جميع المقاطع الصوتية الـ 12 وحساب أزمنتها بنجاح.")


if __name__ == "__main__":
    main()
