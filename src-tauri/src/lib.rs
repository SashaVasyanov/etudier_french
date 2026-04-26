use std::path::PathBuf;

use tauri::WebviewWindowBuilder;

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
