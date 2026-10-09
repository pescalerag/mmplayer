"""Compile/run real Kotlin tag parsing and PCM tests using the Gradle-cached compiler.
Run after an Android build: python scripts/test-replaygain-native.py (JDK 17+).
"""
import os
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
cache = Path(os.environ.get("GRADLE_USER_HOME", Path.home() / ".gradle")) / "caches/modules-2/files-2.1"

def jar(group, artifact, preferred=None):
    directory = cache / group / artifact
    def binaries(paths):
        return [path for path in paths if not path.name.endswith(("-sources.jar", "-javadoc.jar"))]
    candidates = binaries((directory / preferred).glob("*/*.jar")) if preferred else []
    candidates = candidates or binaries(directory.glob("*/*/*.jar"))
    if not candidates:
        raise RuntimeError(f"Build Android first: no cached {artifact}")
    return str(candidates[0])

compiler = jar("org.jetbrains.kotlin", "kotlin-compiler-embeddable", "2.1.20")
stdlib = jar("org.jetbrains.kotlin", "kotlin-stdlib", "2.1.20")
# Older compatible stdlib is sufficient when Gradle resolved another runtime version.
if "2.2." in stdlib:
    stdlib = jar("org.jetbrains.kotlin", "kotlin-stdlib", "2.1.0")
classpath = os.pathsep.join([compiler, stdlib,
    jar("org.jetbrains.kotlin", "kotlin-script-runtime", "2.1.20"),
    jar("org.jetbrains.kotlin", "kotlin-reflect"),
    jar("org.jetbrains.kotlin", "kotlin-daemon-embeddable", "2.1.20"),
    jar("org.jetbrains.intellij.deps", "trove4j", "1.0.20200330"),
    jar("org.jetbrains.kotlinx", "kotlinx-coroutines-core-jvm", "1.9.0"),
    jar("org.jetbrains", "annotations")])
java_home = os.environ.get("JAVA_HOME")
java = str(Path(java_home) / "bin" / ("java.exe" if os.name == "nt" else "java")) if java_home else shutil.which("java")
output = root / "build/replaygain-tests"
output.mkdir(parents=True, exist_ok=True)
sources = [
    root / "node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/kotlinaudio/players/ReplayGainMath.kt",
    root / "modules/native-audio-scanner/android/src/main/java/expo/modules/nativeaudioscanner/ReplayGainReader.kt",
    root / "modules/native-audio-scanner/android/src/main/java/expo/modules/nativeaudioscanner/ReplayGainScanCache.kt",
    root / "tests/native/ReplayGainTest.kt",
    root / "node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/kotlinaudio/players/ReplayGainAudioProcessor.kt",
    *sorted((root / "tests/native/stubs").glob("*.kt"))]
subprocess.run([java, "-cp", classpath, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect",
    "-classpath", stdlib, "-jvm-target", "17", "-d", str(output), *map(str, sources)], check=True)
subprocess.run([java, "-cp", os.pathsep.join([str(output), stdlib]), "ReplayGainTestKt"], check=True)
