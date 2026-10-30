import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the compiled entry shipped to Metro, including RN 0.81's default
// export shape. Testing only the album catalogue cannot catch this native prop bug.
function loadViewConfig(defaultExport: boolean) {
    const resolveImage = jest.fn(source => ({ ...source, resolved: true }));
    const module = { exports: {} as any };
    const nativeRequire = (name: string) => {
        if (name.endsWith('/resolveAssetSource')) return defaultExport ? { default: resolveImage } : resolveImage;
        if (name.endsWith('/processColor')) return { default: (value: unknown) => value };
        if (name.endsWith('/NativeComponentRegistry')) return { get: jest.fn() };
        if (name.endsWith('/ViewConfigIgnore')) return { ConditionallyIgnoredEventHandlers: (value: unknown) => value };
        if (name === 'react-native') return {};
        if (name === '@babel/runtime/helpers/interopRequireDefault') return (value: any) => value?.__esModule ? value : { default: value };
        throw new Error(`Unexpected native view-config dependency: ${name}`);
    };
    runInNewContext(readFileSync(require.resolve('@react-native-community/slider/dist/RNCSliderNativeComponent'), 'utf8'), {
        module, exports: module.exports, require: nativeRequire,
    });
    return { attributes: module.exports.__INTERNAL_VIEW_CONFIG.validAttributes, resolveImage };
}

it.each([true, false])('resolves a native thumb with default-export=%s', defaultExport => {
    const { attributes, resolveImage } = loadViewConfig(defaultExport);
    const source = { uri: 'src_assets_eastereggs_yspsfagsilscrubber', width: 36, height: 36 };
    expect(typeof attributes.thumbImage.process).toBe('function');
    expect(attributes.thumbImage.process(source)).toEqual({ ...source, resolved: true });
    expect(resolveImage).toHaveBeenCalledWith(source);
});

it('retains the ordinary slider colour and progress attributes', () => {
    const { attributes } = loadViewConfig(true);
    expect(attributes.thumbTintColor.process('#FFFFFF')).toBe('#FFFFFF');
    expect(attributes.minimumTrackTintColor.process('#F75E91')).toBe('#F75E91');
    expect(attributes.value).toBe(true);
    expect(attributes.minimumValue).toBe(true);
    expect(attributes.maximumValue).toBe(true);
});
