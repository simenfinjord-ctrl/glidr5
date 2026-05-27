// LayoutHelper.mc — adaptive layout utilities for all screen shapes and sizes

module Ld {
    using Toybox.System;
    using Toybox.Graphics;

    // True if screen is rectangular (FR 265, FR 165, etc.)
    function isRect() {
        var shape = System.getDeviceSettings().screenShape;
        return (shape == System.SCREEN_SHAPE_RECTANGLE ||
                shape == System.SCREEN_SHAPE_SEMI_OCTAGON);
    }

    // True if screen is AMOLED (FR 265, FR 165, Epix Gen 2, Venu 2/3, Fenix 8, etc.)
    function isAmoled() {
        var settings = System.getDeviceSettings();
        if (settings has :displayType) {
            return settings.displayType == 1; // DISPLAY_TYPE_AMOLED
        }
        return false;
    }

    // True if this is a small screen (< 230px tall, e.g. FR255S at 218px)
    function isSmall(h) {
        return h < 230;
    }

    // Half of safe horizontal zone from center
    function hx(w) {
        if (isRect()) { return (w * 0.46).toNumber(); }
        return (w * 0.40).toNumber();
    }

    // Full safe width (hx * 2)
    function fw(w) {
        if (isRect()) { return (w * 0.92).toNumber(); }
        return (w * 0.80).toNumber();
    }

    // Item highlight rectangle height
    function ih(h) {
        if (isAmoled()) { return (h * 0.115).toNumber(); }
        return (h * 0.105).toNumber();
    }

    // Proportional corner radius
    function cr(w) {
        return (w * 0.04).toNumber();
    }

    // Digit cell width for 4-digit code entry
    function dw(w) {
        return (w * 0.16).toNumber();
    }

    // Gap between digit pairs
    function dgap(w) {
        return (w * 0.05).toNumber();
    }

    // ── Adaptive spacing ──────────────────────────────────────────────────────

    // Row spacing for list menus (MainMenu, Settings)
    // Tighter on small screens so all rows fit without overflow
    function rowSpacing(h) {
        if (isSmall(h)) { return (h * 0.135).toNumber(); }
        return (h * 0.155).toNumber();
    }

    // Starting Y for the first menu/settings row
    // Must clear the header text on all screen sizes
    function menuStartY(h) {
        if (isSmall(h)) { return (h * 0.20).toNumber(); }
        return (h * 0.22).toNumber();
    }

    // Starting Y for main menu items (needs to clear username line too)
    function mainMenuStartY(h) {
        if (isSmall(h)) { return (h * 0.30).toNumber(); }
        return (h * 0.33).toNumber();
    }

    // Font for large distance/number display — smaller font on small screens
    // to prevent the number from pushing hints off the bottom
    function distanceFont(h) {
        if (isSmall(h)) { return Graphics.FONT_NUMBER_MILD; }
        return Graphics.FONT_NUMBER_HOT;
    }

    // Y position for the large distance number in HeatView
    function distanceNumY(h) {
        if (isSmall(h)) { return (h * 0.36).toNumber(); }
        return (h * 0.38).toNumber();
    }

    // Y position for "cm" label below the distance number
    // Adjusts based on actual font height so it never overlaps
    function distanceCmY(h) {
        var fontH = Graphics.getFontHeight(distanceFont(h));
        return distanceNumY(h) + fontH + (h * 0.02).toNumber();
    }

    // Y positions for the two hint lines at the bottom of HeatView
    function hintY1(h) {
        if (isSmall(h)) { return (h * 0.76).toNumber(); }
        return (h * 0.75).toNumber();
    }

    function hintY2(h) {
        if (isSmall(h)) { return (h * 0.86).toNumber(); }
        return (h * 0.84).toNumber();
    }

    // ── Drawing helpers ───────────────────────────────────────────────────────

    // Primary accent color
    function accentColor() {
        if (isAmoled()) { return 0x0044CC; }
        return Graphics.COLOR_BLUE;
    }

    // Vertical offset to center FONT_XTINY text inside a highlight bar
    function textVOffset(h) {
        return ((ih(h) - Graphics.getFontHeight(Graphics.FONT_XTINY)) / 2).toNumber();
    }

    // Draw a 4-digit code row with clear active/inactive boxes
    function drawDigitRow(dc, w, centerY, digits, cursorPos) {
        var cellW  = dw(w);
        var cellH  = (cellW * 1.35).toNumber();
        var sep    = (w * 0.03).toNumber();
        var cx     = w / 2;
        var totalW = cellW * 4 + sep;
        var startX = cx - totalW / 2;
        var fontH  = Graphics.getFontHeight(Graphics.FONT_NUMBER_MILD);

        for (var i = 0; i < 4; i++) {
            var cellX  = startX + i * cellW + (i >= 2 ? sep : 0);
            var textX  = cellX + cellW / 2;
            var boxTop = centerY - cellH / 2;

            if (i == cursorPos) {
                dc.setColor(accentColor(), Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(cellX, boxTop, cellW, cellH, cr(w));
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(0x222222, Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(cellX, boxTop, cellW, cellH, cr(w));
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            }

            var textY = centerY - fontH / 2;
            dc.drawText(textX, textY, Graphics.FONT_NUMBER_MILD,
                digits[i].toString(), Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Separator dash between the two pairs
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        var dotX = startX + cellW * 2 + sep / 2;
        dc.drawText(dotX, centerY - Graphics.getFontHeight(Graphics.FONT_XTINY) / 2,
            Graphics.FONT_XTINY, "-", Graphics.TEXT_JUSTIFY_CENTER);
    }

    // Draw a selection highlight bar + label
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
