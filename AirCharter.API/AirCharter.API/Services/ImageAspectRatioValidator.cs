namespace AirCharter.API.Services;

public static class ImageAspectRatioValidator
{
    public static bool HasAspectRatio(byte[] imageBytes, int widthRatio, int heightRatio)
    {
        return TryGetDimensions(imageBytes, out int width, out int height) &&
            (long)width * heightRatio == (long)height * widthRatio;
    }

    private static bool TryGetDimensions(byte[] imageBytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        return TryGetPngDimensions(imageBytes, out width, out height) ||
            TryGetJpegDimensions(imageBytes, out width, out height) ||
            TryGetWebpDimensions(imageBytes, out width, out height);
    }

    private static bool TryGetPngDimensions(byte[] imageBytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (imageBytes.Length < 24 ||
            imageBytes[0] != 0x89 ||
            imageBytes[1] != 0x50 ||
            imageBytes[2] != 0x4E ||
            imageBytes[3] != 0x47)
        {
            return false;
        }

        width = ReadBigEndianInt32(imageBytes, 16);
        height = ReadBigEndianInt32(imageBytes, 20);

        return width > 0 && height > 0;
    }

    private static bool TryGetJpegDimensions(byte[] imageBytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (imageBytes.Length < 4 || imageBytes[0] != 0xFF || imageBytes[1] != 0xD8)
            return false;

        int offset = 2;

        while (offset + 9 < imageBytes.Length)
        {
            if (imageBytes[offset] != 0xFF)
            {
                offset++;
                continue;
            }

            while (offset < imageBytes.Length && imageBytes[offset] == 0xFF)
                offset++;

            if (offset >= imageBytes.Length)
                return false;

            byte marker = imageBytes[offset++];

            if (marker is 0xD8 or 0xD9 or 0x01)
                continue;

            if (offset + 1 >= imageBytes.Length)
                return false;

            int segmentLength = ReadBigEndianUInt16(imageBytes, offset);

            if (segmentLength < 2 || offset + segmentLength > imageBytes.Length)
                return false;

            if (IsJpegStartOfFrameMarker(marker))
            {
                if (segmentLength < 7)
                    return false;

                height = ReadBigEndianUInt16(imageBytes, offset + 3);
                width = ReadBigEndianUInt16(imageBytes, offset + 5);

                return width > 0 && height > 0;
            }

            offset += segmentLength;
        }

        return false;
    }

    private static bool TryGetWebpDimensions(byte[] imageBytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (imageBytes.Length < 20 ||
            !HasAscii(imageBytes, 0, "RIFF") ||
            !HasAscii(imageBytes, 8, "WEBP"))
        {
            return false;
        }

        int offset = 12;

        while (offset + 8 <= imageBytes.Length)
        {
            string chunkType = GetAscii(imageBytes, offset, 4);
            int chunkSize = ReadLittleEndianInt32(imageBytes, offset + 4);
            int chunkDataOffset = offset + 8;

            if (chunkSize < 0 || chunkDataOffset + chunkSize > imageBytes.Length)
                return false;

            if (chunkType == "VP8X" && chunkSize >= 10)
            {
                width = 1 + ReadLittleEndianUInt24(imageBytes, chunkDataOffset + 4);
                height = 1 + ReadLittleEndianUInt24(imageBytes, chunkDataOffset + 7);
                return true;
            }

            if (chunkType == "VP8L" && chunkSize >= 5 && imageBytes[chunkDataOffset] == 0x2F)
            {
                int b1 = imageBytes[chunkDataOffset + 1];
                int b2 = imageBytes[chunkDataOffset + 2];
                int b3 = imageBytes[chunkDataOffset + 3];
                int b4 = imageBytes[chunkDataOffset + 4];

                width = 1 + (((b2 & 0x3F) << 8) | b1);
                height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
                return true;
            }

            if (chunkType == "VP8 " &&
                chunkSize >= 10 &&
                imageBytes[chunkDataOffset + 3] == 0x9D &&
                imageBytes[chunkDataOffset + 4] == 0x01 &&
                imageBytes[chunkDataOffset + 5] == 0x2A)
            {
                width = ReadLittleEndianUInt16(imageBytes, chunkDataOffset + 6) & 0x3FFF;
                height = ReadLittleEndianUInt16(imageBytes, chunkDataOffset + 8) & 0x3FFF;
                return width > 0 && height > 0;
            }

            offset = chunkDataOffset + chunkSize + (chunkSize % 2);
        }

        return false;
    }

    private static bool IsJpegStartOfFrameMarker(byte marker)
    {
        return marker is 0xC0 or 0xC1 or 0xC2 or 0xC3 or 0xC5 or 0xC6 or 0xC7 or 0xC9 or 0xCA or 0xCB or 0xCD or 0xCE or 0xCF;
    }

    private static int ReadBigEndianInt32(byte[] bytes, int offset)
    {
        return (bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3];
    }

    private static int ReadBigEndianUInt16(byte[] bytes, int offset)
    {
        return (bytes[offset] << 8) | bytes[offset + 1];
    }

    private static int ReadLittleEndianInt32(byte[] bytes, int offset)
    {
        return bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24);
    }

    private static int ReadLittleEndianUInt16(byte[] bytes, int offset)
    {
        return bytes[offset] | (bytes[offset + 1] << 8);
    }

    private static int ReadLittleEndianUInt24(byte[] bytes, int offset)
    {
        return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    }

    private static bool HasAscii(byte[] bytes, int offset, string value)
    {
        return offset + value.Length <= bytes.Length && GetAscii(bytes, offset, value.Length) == value;
    }

    private static string GetAscii(byte[] bytes, int offset, int length)
    {
        return System.Text.Encoding.ASCII.GetString(bytes, offset, length);
    }
}
