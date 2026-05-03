// QueueListView.mc — shows active watch queue fetched by team PIN

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Communications;
using Toybox.Application.Storage;

class QueueListView extends WatchUi.View {
    var teamPin;
    var isLoading = true;
    var items = [];          // array of Dictionaries from server
    var selectedIndex = 0;
    var statusText = "Loading...";
    var errorText = null;

    function initialize(pin) {
        View.initialize();
        teamPin = pin;
    }

    function onShow() {
        fetchList();
    }

    function fetchList() {
        isLoading = true;
        statusText = "Loading...";
        errorText = null;
        WatchUi.requestUpdate();

        var url = ServerConfig.BASE_URL + "/api/watch/list/" + teamPin;
        var userCode = Storage.getValue("userCode");
        if (userCode != null) {
            url = url + "?userCode=" + userCode;
        }
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
                statusText = "Queue is empty";
                errorText = "Add tests from web app";
            } else {
                statusText = "";
                errorText = null;
                selectedIndex = 0;
            }
        } else if (responseCode == 404 || responseCode == 403) {
            // PIN no longer valid, or no longer have access → clear stored credentials and re-login
            Storage.deleteValue("teamPin");
            Storage.deleteValue("teamName");
            var msg = (data != null && data instanceof Dictionary && data["message"] != null)
                ? data["message"] : (responseCode == 404 ? "PIN not found" : "Access denied");
            var codeView = new PersonalCodeView();
            codeView.isLoginMode = true;
            codeView.statusText = msg;
            var codeDelegate = new PersonalCodeDelegate(codeView, null, null, true);
            WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_RIGHT);
            return;
        } else {
            errorText = "Error " + responseCode.toString();
            statusText = "Try again";
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
        dc.drawText(cx, h * 0.05, Graphics.FONT_SMALL, "From List", Graphics.TEXT_JUSTIFY_CENTER);

        if (isLoading) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.38, Graphics.FONT_SMALL, statusText, Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 0.52, Graphics.FONT_XTINY, "Please wait...", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        if (items.size() == 0) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.38, Graphics.FONT_SMALL, statusText, Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.52, Graphics.FONT_XTINY, "Add tests via the", Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, h * 0.60, Graphics.FONT_XTINY, "Glidr web app", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        // Show up to 3 items, centered on selectedIndex
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
                dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
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
