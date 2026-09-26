// BROWSE-ENV managed Firefox profile: Development
user_pref("toolkit.policies.perUserDir", true);
user_pref("browser.policies.loglevel", "error");
user_pref("browser.shell.checkDefaultBrowser", false);

user_pref("browser.contentblocking.category", "strict");
user_pref("privacy.trackingprotection.enabled", true);
user_pref("privacy.trackingprotection.pbmode.enabled", true);
user_pref("network.cookie.cookieBehavior", 5);
// Local HTTP services are expected in this profile.
user_pref("dom.security.https_only_mode", false);
user_pref("dom.security.https_only_mode_pbm", true);
user_pref("privacy.donottrackheader.enabled", true);

user_pref("permissions.default.camera", 0);
user_pref("permissions.default.microphone", 0);
user_pref("permissions.default.geo", 0);
user_pref("permissions.default.desktop-notification", 2);
user_pref("media.autoplay.default", 5);
user_pref("browser.download.useDownloadDir", false);
user_pref("browser.download.always_ask_before_handling_new_types", true);

user_pref("browser.search.suggest.enabled", false);
user_pref("browser.urlbar.suggest.searches", false);
user_pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
user_pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false);
user_pref("browser.newtabpage.activity-stream.showSponsored", false);
user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
user_pref("browser.ml.chat.enabled", false);
user_pref("browser.shopping.experience2023.enabled", false);
user_pref("extensions.pocket.enabled", false);

user_pref("identity.fxaccounts.enabled", false);
user_pref("services.sync.engine.passwords", false);
user_pref("signon.rememberSignons", false);
user_pref("browser.formfill.enable", false);
user_pref("extensions.formautofill.addresses.enabled", false);
user_pref("extensions.formautofill.creditCards.enabled", false);

user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.unified", false);
user_pref("app.shield.optoutstudies.enabled", false);

