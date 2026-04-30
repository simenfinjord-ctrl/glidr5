// MainMenuView.mc — main menu: From List / From Code / Archive / Settings

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Application.Storage;

class MainMenuView extends WatchUi.View {
    var teamPin;
    var selectedIndex = 0;

    var menuItems = [
        ["From List",  "Tests queued from app"],
        ["From Code",  "Enter 4-digit session code"],
        ["Archive",    "Last 10 completed"],
        ["Settings",   "Vibration, sounds, PIN"],
    ];

    function initialize(pin) {
        View.initialize();
        teamPin = pin;
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        // ── Header ──────────────────────────────────────────────
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.03, Graphics.FONT_SMALL, "GLIDR", Graphics.TEXT_JUSTIFY_CENTER);

        var teamName = Storage.getValue("teamName");
        var userName = Storage.getValue("userName");

        if (teamName != null && userName != null) {
            // Both team and user name: show both on one header line each
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.14, Graphics.FONT_XTINY, teamName, Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.21, Graphics.FONT_XTINY, userName, Graphics.TEXT_JUSTIFY_CENTER);
        } else if (teamName != null) {
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.17, Graphics.FONT_XTINY, teamName, Graphics.TEXT_JUSTIFY_CENTER);
        } else if (userName != null) {
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.17, Graphics.FONT_XTINY, userName, Graphics.TEXT_JUSTIFY_CENTER);
        }

        // ── Menu items ───────────────────────────────────────────
        // 4 items starting at 29%, spaced 17% apart → last at 80%
        for (var i = 0; i < menuItems.size(); i++) {
            var itemY = h * 0.29 + i * (h * 0.165);

            if (i == selectedIndex) {
                dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(cx - w * 0.42, itemY - 3, w * 0.84, 32, 6);
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            }

            dc.drawText(cx, itemY, Graphics.FONT_SMALL, menuItems[i][0], Graphics.TEXT_JUSTIFY_CENTER);
        }

        // ── Hint ────────────────────────────────────────────────
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.92, Graphics.FONT_XTINY, "UP/DN: navigate  SELECT: open", Graphics.TEXT_JUSTIFY_CENTER);
    }
}
