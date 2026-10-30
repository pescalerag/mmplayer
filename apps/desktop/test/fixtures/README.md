`tone.mp3` and `tone.flac` are synthetic 440 Hz tones (0.25 seconds) generated for these tests, with the title `Fixture`. They contain no third-party recording.

Generated with FFmpeg's `sine` source, `libmp3lame -q:a 9` and `flac`. Tests do not require FFmpeg: they use these small fixtures to compare the actual compressed audio payload before and after changing tags.
