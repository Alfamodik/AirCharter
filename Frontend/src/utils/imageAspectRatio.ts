export type ImageAspectRatio = {
    width: number;
    height: number;
};

export async function validateImageAspectRatio(
    file: File,
    aspectRatio: ImageAspectRatio
): Promise<boolean> {
    const dimensions = await getImageDimensions(file);

    return dimensions.width * aspectRatio.height === dimensions.height * aspectRatio.width;
}

function getImageDimensions(file: File): Promise<ImageAspectRatio> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({
                width: image.naturalWidth,
                height: image.naturalHeight
            });
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Invalid image"));
        };

        image.src = objectUrl;
    });
}
