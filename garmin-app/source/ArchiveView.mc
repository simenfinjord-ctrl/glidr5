// ArchiveView.mc — shows last 10 completed sessions (can be resumed)

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Communications;

class ArchiveView extends WatchUi.View {
    var teamPin;
    var isLoading = true;
    var items = [];
    var selectedIndex = 0;
    var statusText = "Loading...";

    function initialize(pin) {
        View.initialize();
        teamPin = pin;
    }

    function onShow() {
        fetchArchive();
    }

    function fetchArchive() {
        isLoading = true;
        WatchUi.requestUpdate();

        var url = ServerConfig.BASE_URL + "/api/watch/archive/" + teamPin;
        Communications.makeWebRequest(
            url,
            null,
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onFetchResponse)
        );
    }

    function onFetchResponse(responseCode, data) {
        isLoading = false;
        if (responseCode == 200 && data != null && data instanceof Dictionary && data["items"] != null) {
            items = data["items"];
            if (items.size() == 0) {
                statusText = "No archived tests";
            } else {
                statusText = "";
                selectedIndex = 0;
            }
        } else {
            statusText = "Error loading archive";
        }
        WatchUi.requestUpdate();
    }

    function getItemLabel(item) {
        if (item["test_name"] != null && !item["test_name"].equals("")) {
            return item["test_name"];
        }
        if (item["series_name"] != null && !item["series_name"].equals("")) {
            return item["series_name"];
        }
        return "Test #" + item["id"].toString();
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        // Header
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.05, Graphics.FONT_SMALL, "Archive", Graphics.TEXT_JUSTIFY_CENTER);

        if (isLoading) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.45, Graphics.FONT_SMALL, "Loading...", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        if (items.size() == 0) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.38, Graphics.FONT_SMALL, statusText, Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.52, Graphics.FONT_XTINY, "Completed tests appear here", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        // Show up to 3 items
        var visibleStart = selectedIndex > 0 ? selectedIndex - 1 : 0;
        var visibleEnd = visibleStart + 2;
        if (visibleEnd >= items.size()) {
            visibleEnd = items.size() - 1;
            visibleStart = visibleEnd > 1 ? visibleEnd - 2 : 0;
        }

        var yStart = h * 0.22;
        var itemSpacing = h * 0.24;

        for (var i = visibleStart; i <= visibleEnd; i++) {
            var item = items[i];
            var label = getItemLabel(item);
            var yPos = yStart + (i - visibleStart) * itemSpacing;

            if (i == selectedIndex) {
                dc.setColor(Graphics.COLOR_DK_GREEN, Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(cx - w * 0.44, yPos - 4, w * 0.88, 30, 6);
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            }
            dc.drawText(cx, yPos, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Scroll indicators
        if (selectedIndex > 0) {
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.14, Graphics.FONT_XTINY, "▲", Graphics.TEXT_JUSTIFY_CENTER);
        }
        if (selectedIndex < items.size() - 1) {
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.88, Graphics.FONT_XTINY, "▼", Graphics.TEXT_JUSTIFY_CENTER);
        }

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.95, Graphics.FONT_XTINY, selectedIndex + 1 + "/" + items.size(), Graphics.TEXT_JUSTIFY_CENTER);
    }
}
