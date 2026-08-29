use tauri::{
    utils::config::{BackgroundThrottlingPolicy, FrontendDist},
    webview::{NewWindowResponse, WebviewWindowBuilder},
    Url, WebviewUrl,
};

fn configured_app_url(app: &tauri::App) -> Option<Url> {
    #[cfg(dev)]
    {
        app.config().build.dev_url.clone()
    }

    #[cfg(not(dev))]
    {
        match app.config().build.frontend_dist.as_ref() {
            Some(FrontendDist::Url(url)) => Some(url.clone()),
            _ => None,
        }
    }
}

fn has_same_origin(allowed: &Url, candidate: &Url) -> bool {
    candidate.scheme() == allowed.scheme()
        && candidate.host_str() == allowed.host_str()
        && candidate.port_or_known_default() == allowed.port_or_known_default()
}

fn is_local_asset_origin(candidate: &Url) -> bool {
    (candidate.scheme() == "tauri" && candidate.host_str() == Some("localhost"))
        || ((candidate.scheme() == "http" || candidate.scheme() == "https")
            && candidate.host_str() == Some("tauri.localhost"))
}

fn navigation_is_allowed(allowed: Option<&Url>, candidate: &Url) -> bool {
    candidate.as_str() == "about:blank"
        || allowed
            .map(|origin| has_same_origin(origin, candidate))
            .unwrap_or_else(|| is_local_asset_origin(candidate))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let allowed_origin = configured_app_url(app);

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("AIVirTeach Learning Workspace")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1000.0, 700.0)
                .center()
                .resizable(true)
                .background_throttling(BackgroundThrottlingPolicy::Disabled)
                .on_navigation(move |url| navigation_is_allowed(allowed_origin.as_ref(), url))
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run AIVirTeach desktop");
}

#[cfg(test)]
mod tests {
    use super::{has_same_origin, navigation_is_allowed};
    use tauri::Url;

    #[test]
    fn permits_only_the_configured_remote_origin() {
        let allowed = Url::parse("https://learn.example.com/").unwrap();
        let workspace = Url::parse("https://learn.example.com/workspace").unwrap();
        let different_port = Url::parse("https://learn.example.com:8443/workspace").unwrap();
        let untrusted = Url::parse("https://evil.example/workspace").unwrap();

        assert!(has_same_origin(&allowed, &workspace));
        assert!(navigation_is_allowed(Some(&allowed), &workspace));
        assert!(!navigation_is_allowed(Some(&allowed), &different_port));
        assert!(!navigation_is_allowed(Some(&allowed), &untrusted));
    }
}
