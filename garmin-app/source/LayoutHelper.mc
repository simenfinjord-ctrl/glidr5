// LayoutHelper.mc — adaptive layout utilities for all screen shapes and sizes
// Usage: Ld.hx(w), Ld.fw(w), Ld.ih(h), Ld.dw(w)

module Ld {
    using Toybox.System;

    // True if screen is rectangular (FR 265, FR 165, etc.)
    function isRect() {
        var shape = System.getDeviceSettings().screenShape;
        // SCREEN_SHAPE_RECTANGLE=3, SCREEN_SHAPE_SEMI_OCTAGON=4
        return (shape == System.SCREEN_SHAPE_RECTANGLE ||
                shape == System.SCREEN_SHAPE_SEMI_OCTAGON);
    }

    // Half of safe horizontal zone from center (for fillRoundedRectangle x offset)
    // Round screens: 43% from center. Rect screens: 46% (use more width).
    function hx(w) {
        if (isRect()) { return (w * 0.46).toNumber(); }
        return (w * 0.43).toNumber();
    }

    // Full safe width (hx * 2)
    function fw(w) {
        if (isRect()) { return (w * 0.92).toNumber(); }
        return (w * 0.86).toNumber();
    }

    // Item highlight rectangle height — relative to screen height
    function ih(h) {
        return (h * 0.09).toNumber();
    }

    // Digit cell width for 4-digit code entry
    function dw(w) {
        return (w * 0.14).toNumber();
    }

    // Gap between digit pairs (the separator in xx-xx)
    function dgap(w) {
        return (w * 0.04).toNumber();
    }
}
