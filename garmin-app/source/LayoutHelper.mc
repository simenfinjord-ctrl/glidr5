// LayoutHelper.mc — adaptive layout utilities for all screen shapes and sizes
// Usage: Ld.hx(w), Ld.fw(w), Ld.ih(h), Ld.dw(w), Ld.cr(w), Ld.isAmoled(), Ld.accentColor()

module Ld {
    using Toybox.System;
    using Toybox.Graphics;

    // True if screen is rectangular (FR 265, FR 165, etc.)
    function isRect() {
        var shape = System.getDeviceSettings().screenShape;
        // SCREEN_SHAPE_RECTANGLE=3, SCREEN_SHAPE_SEMI_OCTAGON=4
        return (shape == System.SCREEN_SHAPE_RECTANGLE ||
                shape == System.SCREEN_SHAPE_SEMI_OCTAGON);
    }

    // True if screen is AMOLED (FR 265, FR 165, Epix Gen 2, Venu 2/3, Fenix 8, etc.)
    // Uses CIQ 3.2+ displayType when available; falls back to palette check.
    function isAmoled() {
        var settings = System.getDeviceSettings();
        if (settings has :displayType) {
            // DISPLAY_TYPE_AMOLED = 1 (CIQ 3.2+)
            return settings.displayType == 1;
        }
        // Fallback: assume MIP on older SDK builds
        return false;
    }

    // Half of safe horizontal zone from center (for fillRoundedRectangle x offset)
    // Round screens: 40% from center. Rect screens: 46% (use more width).
    function hx(w) {
        if (isRect()) { return (w * 0.46).toNumber(); }
        return (w * 0.40).toNumber();
    }

    // Full safe width (hx * 2)
    function fw(w) {
        if (isRect()) { return (w * 0.92).toNumber(); }
        return (w * 0.80).toNumber();
    }

    // Item highlight rectangle height — tall enough for text + vertical padding
    // AMOLED screens tend to be larger so we use slightly more height
    function ih(h) {
        if (isAmoled()) { return (h * 0.115).toNumber(); }
        return (h * 0.105).toNumber();
    }

    // Proportional corner radius for fillRoundedRectangle
    // Scales with screen size so it looks consistent across 176px and 260px screens
    function cr(w) {
        return (w * 0.04).toNumber();
    }

    // Digit cell width for 4-digit code entry
    function dw(w) {
        return (w * 0.14).toNumber();
    }

    // Gap between digit pairs (the separator in xx-xx)
    function dgap(w) {
        return (w * 0.04).toNumber();
    }

    // Vertical offset to vertically center text inside a highlight bar of height ih(h)
    // drawText y-coordinate is the top of the text bounding box, so we nudge it down
    function textVOffset(h) {
        return ((ih(h) - Graphics.getFontHeight(Graphics.FONT_XTINY)) / 2).toNumber();
    }

    // Primary accent / highlight fill color
    // AMOLED: richer blue. MIP: palette blue (best contrast on transflective).
    function accentColor() {
        if (isAmoled()) { return 0x0044CC; }   // vivid blue — full 24-bit on AMOLED
        return Graphics.COLOR_BLUE;             // palette blue — safe on MIP
    }

    // Draw a selection highlight bar + label in one call.
    // cx: horizontal center. y: top of bar. w, h: screen dims. label: string.
    function drawSelectedRow(dc, cx, y, w, h, label) {
        dc.setColor(accentColor(), Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(cx - hx(w), y, fw(w), ih(h), cr(w));
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, y + textVOffset(h), Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);
    }

    // Draw an unselected row label
    function drawNormalRow(dc, cx, y, h, label) {
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, y + textVOffset(h), Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);
    }
}
