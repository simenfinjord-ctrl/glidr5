// PersonalCodeView.mc — Enter your personal 4-digit watch code.
// Used both for initial login (isLoginMode = true) and from Settings to change your code.

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Application.Storage;

class PersonalCodeView extends WatchUi.View {
    var digits = [0, 0, 0, 0];
    var cursorPos = 0;
    var statusText = null;   // null = use default based on mode
    var isVerifying = false;
    var isLoginMode = false; // set externally before showing

    function initialize() {
        View.initialize();
        // Pre-fill with existing code if stored
        var existing = Storage.getValue("userCode");
        if (existing != null && existing instanceof String && existing.length() == 4) {
            for (var i = 0; i < 4; i++) {
                digits[i] = existing.substring(i, i + 1).toNumber();
            }
        }
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        // ── Header ──────────────────────────────────────────────
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        if (isLoginMode) {
            dc.drawText(cx, h * 0.04, Graphics.FONT_SMALL, "GLIDR LOGIN", Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.16, Graphics.FONT_XTINY, "Step 1 of 2", Graphics.TEXT_JUSTIFY_CENTER);
        } else {
            dc.drawText(cx, h * 0.06, Graphics.FONT_SMALL, "MY CODE", Graphics.TEXT_JUSTIFY_CENTER);
        }

        // ── Status text ─────────────────────────────────────────
        var displayStatus = statusText;
        if (displayStatus == null) {
            displayStatus = isLoginMode ? "Enter personal ID" : "Enter your code";
        }
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.25, Graphics.FONT_XTINY, displayStatus, Graphics.TEXT_JUSTIFY_CENTER);

        // ── Label ───────────────────────────────────────────────
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        var labelText = isLoginMode ? "Personal ID" : "Personal code";
        dc.drawText(cx, h * 0.35, Graphics.FONT_XTINY, labelText, Graphics.TEXT_JUSTIFY_CENTER);

        // ── Digit boxes ─────────────────────────────────────────
        var digitWidth = 36;
        var totalWidth = digitWidth * 4 + 10;
        var startX = cx - totalWidth / 2;
        var digitY = h * 0.45;

        for (var i = 0; i < 4; i++) {
            var dx = startX + i * digitWidth + (i >= 2 ? 10 : 0);
            var textX = dx + digitWidth / 2;

            if (i == cursorPos) {
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            }

            dc.drawText(textX, digitY, Graphics.FONT_NUMBER_MILD,
                digits[i].toString(), Graphics.TEXT_JUSTIFY_CENTER);

            if (i == cursorPos) {
                var underlineY = digitY + 30;
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(2);
                dc.drawLine(textX - 10, underlineY, textX + 10, underlineY);
                dc.setPenWidth(1);
            }
        }

        // ── Hints ───────────────────────────────────────────────
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.70, Graphics.FONT_XTINY, "UP/DN: change digit", Graphics.TEXT_JUSTIFY_CENTER);
        if (isLoginMode) {
            dc.drawText(cx, h * 0.78, Graphics.FONT_XTINY, "SELECT: next digit / continue", Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 0.86, Graphics.FONT_XTINY, "BACK: prev digit", Graphics.TEXT_JUSTIFY_CENTER);
        } else {
            dc.drawText(cx, h * 0.78, Graphics.FONT_XTINY, "SELECT: next / confirm", Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 0.86, Graphics.FONT_XTINY, "BACK: prev / cancel", Graphics.TEXT_JUSTIFY_CENTER);
        }

        // ── Stored name (settings mode only) ────────────────────
        if (!isLoginMode) {
            var storedName = Storage.getValue("userName");
            if (storedName != null) {
                dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, h * 0.93, Graphics.FONT_XTINY, storedName, Graphics.TEXT_JUSTIFY_CENTER);
            }
        }
    }

    function getCode() {
        var code = "";
        for (var i = 0; i < 4; i++) {
            code += digits[i].toString();
        }
        return code;
    }
}
