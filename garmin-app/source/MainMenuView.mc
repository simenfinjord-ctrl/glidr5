// MainMenuView.mc — main menu: From List / From Code / Archive / Settings

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Application.Storage;

class MainMenuView extends WatchUi.View {
    var teamPin;
    var selectedIndex = 0;

    // Menu items: label + subtitle
    var menuItems = [
        ["From List", "Tests queued from app"],
        ["From Code", "Enter 4-digit session code"],
        ["Archive", "Last 10 completed"],
        ["Settings", "Change team PIN"],
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

        // Header
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.05, Graphics.FONT_SMALL, "GLIDR", Graphics.TEXT_JUSTIFY_CENTER);

        var teamName = Storage.getValue("teamName");
        if (teamName != null) {
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.18, Graphics.FONT_XTINY, teamName, Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Draw menu items
        var itemH = h / 5;
        for (var i = 0; i < menuItems.size(); i++) {
            var itemY = h * 0.28 + i * (h * 0.17);

            if (i == selectedIndex) {
                // Highlight selected item
                dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(cx - w * 0.42, itemY - 4, w * 0.84, 34, 6);
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            }

            dc.drawText(cx, itemY, Graphics.FONT_SMALL, menuItems[i][0], Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Hint
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.90, Graphics.FONT_XTINY, "UP/DN: navigate  SELECT: open", Graphics.TEXT_JUSTIFY_CENTER);
    }
}
