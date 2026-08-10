#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|argument| argument == "--store-credential") {
        if let Err(error) = aivirteach_client_lib::store_credential_from_environment() {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }
    if std::env::args().any(|argument| argument == "--probe") {
        if let Err(error) = aivirteach_client_lib::probe_from_environment() {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }
    aivirteach_client_lib::run();
}
