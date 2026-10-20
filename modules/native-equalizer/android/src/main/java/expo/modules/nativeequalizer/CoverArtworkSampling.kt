package expo.modules.nativeequalizer

internal fun calculateCoverSampleSize(width: Int, height: Int): Int {
    require(width > 0 && height > 0) { "Unable to read artwork dimensions" }

    // BitmapFactory.Options.inSampleSize starts at zero. Calculate the factor
    // from one before assigning it to the decoder, never dividing by its default.
    var sampleSize = 1
    val longestSide = maxOf(width, height).toLong()
    while (longestSide > 256L * sampleSize) {
        sampleSize *= 2
    }
    return sampleSize
}
