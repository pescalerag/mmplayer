package expo.modules.nativeequalizer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CoverArtworkSamplingTest {
    @Test
    fun smallArtworkUsesOneInsteadOfTheZeroDecoderDefault() {
        for ((width, height) in listOf(1 to 1, 100 to 50, 255 to 128, 256 to 256)) {
            assertEquals(1, calculateCoverSampleSize(width, height))
        }
    }

    @Test
    fun largeArtworkIsReducedWithinTheColorExtractionBudget() {
        assertEquals(2, calculateCoverSampleSize(257, 256))
        assertEquals(2, calculateCoverSampleSize(512, 512))
        assertEquals(4, calculateCoverSampleSize(513, 128))
        assertEquals(16, calculateCoverSampleSize(4000, 3000))
        assertEquals(16, calculateCoverSampleSize(3000, 4000))
    }

    @Test
    fun samplingIsPositiveAndPowerOfTwoWithoutOverflowingForExtremeSizes() {
        for (side in listOf(1, 256, 257, 512, 513, 4096, 8192, Int.MAX_VALUE)) {
            val sample = calculateCoverSampleSize(side, 1)
            assertTrue(sample > 0)
            assertEquals(0, sample and (sample - 1))
            assertTrue(side.toLong() <= 256L * sample)
        }
    }

    @Test(expected = IllegalArgumentException::class)
    fun unreadableArtworkDoesNotReachThePixelDecoder() {
        calculateCoverSampleSize(-1, -1)
    }

    @Test(expected = IllegalArgumentException::class)
    fun zeroWidthIsRejected() {
        calculateCoverSampleSize(0, 256)
    }

    @Test(expected = IllegalArgumentException::class)
    fun zeroHeightIsRejected() {
        calculateCoverSampleSize(256, 0)
    }
}
