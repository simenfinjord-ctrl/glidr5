// ArchiveDelegate.mc — handles navigation in archive and resumes a session

using Toybox.WatchUi;
using Toybox.Communications;

class ArchiveDelegate extends WatchUi.BehaviorDelegate {
    var view;
    var isResuming = false;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onNextPage() {
        if (view.items.size() == 0) { return true; }
        if (view.selectedIndex < view.items.size() - 1) {
            view.selectedIndex++;
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onPreviousPage() {
        if (view.items.size() == 0) { return true; }
        if (view.selectedIndex > 0) {
            view.selectedIndex--;
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onSelect() {
        if (view.isLoading || isResuming || view.items.size() == 0) { return true; }

        var item = view.items[view.selectedIndex];
        isResuming = true;
        WatchUi.requestUpdate();

        // Try to resume: look up existing watch session for this test
        var itemId = item["id"].toString();
        var url = ServerConfig.BASE_URL + "/api/watch/list/" + view.teamPin + "/start/" + itemId;

        // First restore to active, then start
        var restoreUrl = ServerConfig.BASE_URL + "/api/watch/queue/" + itemId + "/restore";
        // Note: we can't chain requests easily in Monkey C, so we just call start directly
        // The restore will happen server-side when the web user wants it from archive
        // For watch, just attempt to load the session if it still exists
        if (item["test_id"] != null) {
            resumeSession(item);
        } else {
            // No test ID — nothing to resume
            isResuming = false;
            view.statusText = "Cannot resume";
            WatchUi.requestUpdate();
        }
        return true;
    }

    function resumeSession(item) {
        var testId = item["test_id"].toString();
        // Try to find any active watch session for this test via the code entry fallback
        // Show a "no active session" message — user must restart from code
        isResuming = false;
        // Switch to code entry with a hint
        var codeView = new CodeEntryView();
        codeView.statusText = "Enter session code\nto resume";
        var codeDelegate = new CodeEntryDelegate(codeView);
        WatchUi.switchToView(codeView, codeDelegate, WatchUi.SLIDE_LEFT);
    }

    function onBack() {
        var menuView = new MainMenuView(view.teamPin);
        var menuDelegate = new MainMenuDelegate(menuView);
        WatchUi.switchToView(menuView, menuDelegate, WatchUi.SLIDE_RIGHT);
        return true;
    }
}
