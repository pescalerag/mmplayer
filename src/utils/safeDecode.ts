export function safeDecodeURIComponent(str: string): string {
    try {
        return decodeURIComponent(str);
    } catch {
        return str;
    }
}

export function getSafeFileName(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    const rawName = lastSlash === -1 ? path : path.substring(lastSlash + 1);
    return safeDecodeURIComponent(rawName);
}
