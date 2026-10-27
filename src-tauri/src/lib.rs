use std::path::PathBuf;

use tauri::{Manager, WebviewWindowBuilder};

/// Progress is mirrored to this file in the app's data folder
/// (~/Library/Application Support/com.etudier.french on macOS), so it
/// survives cleared WebView data. The previous version is kept as .bak.
const PROGRESS_FILE: &str = "progress.json";

fn progress_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
  std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
  Ok(directory.join(PROGRESS_FILE))
}

#[tauri::command]
fn read_progress(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let path = progress_path(&app)?;
  for candidate in [path.clone(), path.with_extension("json.bak")] {
    match std::fs::read_to_string(&candidate) {
      Ok(contents) if !contents.trim().is_empty() => return Ok(Some(contents)),
      Ok(_) => continue,
      Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
      Err(error) => return Err(error.to_string()),
    }
  }
  Ok(None)
}

#[tauri::command]
fn progress_location(app: tauri::AppHandle) -> Result<String, String> {
  progress_path(&app).map(|path| path.display().to_string())
}

/// Atomic: the new contents go to a temporary file that then replaces the
/// old one, so a crash mid-write never leaves a half-written file.
#[tauri::command]
fn write_progress(app: tauri::AppHandle, contents: String) -> Result<(), String> {
  let path = progress_path(&app)?;
  let temporary = path.with_extension("json.tmp");
  std::fs::write(&temporary, contents.as_bytes()).map_err(|error| error.to_string())?;
  if path.exists() {
    let _ = std::fs::copy(&path, path.with_extension("json.bak"));
  }
  std::fs::rename(&temporary, &path).map_err(|error| error.to_string())
}

/// Reviews due on the Dock icon; `None` or 0 removes the badge.
#[tauri::command]
fn set_dock_badge(app: tauri::AppHandle, count: Option<i64>) -> Result<(), String> {
  let window = app.get_webview_window("main").ok_or("no main window")?;
  window.set_badge_count(count.filter(|value| *value > 0)).map_err(|error| error.to_string())
}

/// Replaces the scheduled reminder: macOS shows it at `at` (Unix seconds),
/// even if the app has been quit by then. `None` only cancels.
#[tauri::command]
fn schedule_reminder(at: Option<f64>, title: String, body: String) -> Result<(), String> {
  replace_scheduled_reminder(at, &title, &body);
  Ok(())
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn replace_scheduled_reminder(at: Option<f64>, title: &str, body: &str) {
  use objc2_foundation::{NSArray, NSDate, NSString, NSUserNotification, NSUserNotificationCenter};

  let center = NSUserNotificationCenter::defaultUserNotificationCenter();
  center.setScheduledNotifications(&NSArray::<NSUserNotification>::new());
  if let Some(seconds) = at {
    let notification = NSUserNotification::new();
    notification.setTitle(Some(&NSString::from_str(title)));
    notification.setInformativeText(Some(&NSString::from_str(body)));
    notification.setDeliveryDate(Some(&NSDate::dateWithTimeIntervalSince1970(seconds)));
    center.scheduleNotification(&notification);
  }
}

#[cfg(not(target_os = "macos"))]
fn replace_scheduled_reminder(_at: Option<f64>, _title: &str, _body: &str) {}

fn resolve_portable_data_directory() -> Option<PathBuf> {
  #[cfg(target_os = "windows")]
  {
    let executable_path = std::env::current_exe().ok()?;
    let executable_dir = executable_path.parent()?;
    let product_name = executable_path
      .file_stem()
      .and_then(|value| value.to_str())
      .filter(|value| !value.trim().is_empty())
      .unwrap_or("etudier-french");
    let data_directory = executable_dir.join(format!("{product_name}.data"));

    if std::fs::create_dir_all(&data_directory).is_ok() {
      return Some(data_directory);
    }
  }

  None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![read_progress, write_progress, progress_location, set_dock_badge, schedule_reminder])
    .setup(|app| {
      let window_config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| tauri::Error::WindowLabelAlreadyExists("main".into()))?;

      let mut builder = WebviewWindowBuilder::from_config(app, &window_config)?;

      if let Some(data_directory) = resolve_portable_data_directory() {
        builder = builder.data_directory(data_directory);
      }

      builder.build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
