use std::fmt;
use tauri::Error as TauriError;

#[derive(Debug)]
pub enum LumenError {
    Io(std::io::Error),
    Json(serde_json::Error),
    Tauri(TauriError),
    Sqlite(rusqlite::Error),
    Parse(String),
    NotFound(String),
    InvalidInput(String),
    LaunchFailed(String),
    Config(String),
}

impl fmt::Display for LumenError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LumenError::Io(e) => write!(f, "I/O error: {}", e),
            LumenError::Json(e) => write!(f, "JSON error: {}", e),
            LumenError::Tauri(e) => write!(f, "Tauri error: {}", e),
            LumenError::Sqlite(e) => write!(f, "SQLite error: {}", e),
            LumenError::Parse(e) => write!(f, "Parse error: {}", e),
            LumenError::NotFound(e) => write!(f, "Not found: {}", e),
            LumenError::InvalidInput(e) => write!(f, "Invalid input: {}", e),
            LumenError::LaunchFailed(e) => write!(f, "Launch failed: {}", e),
            LumenError::Config(e) => write!(f, "Config error: {}", e),
        }
    }
}

impl std::error::Error for LumenError {}

impl From<std::io::Error> for LumenError {
    fn from(e: std::io::Error) -> Self {
        LumenError::Io(e)
    }
}

impl From<serde_json::Error> for LumenError {
    fn from(e: serde_json::Error) -> Self {
        LumenError::Json(e)
    }
}

impl From<TauriError> for LumenError {
    fn from(e: TauriError) -> Self {
        LumenError::Tauri(e)
    }
}

impl From<rusqlite::Error> for LumenError {
    fn from(e: rusqlite::Error) -> Self {
        LumenError::Sqlite(e)
    }
}

// Tauri requires this for commands that return Result
impl From<LumenError> for TauriError {
    fn from(e: LumenError) -> Self {
        TauriError::Anyhow(e.into())
    }
}

// Tauri 2 requires this for command error handling
impl From<LumenError> for tauri::ipc::InvokeError {
    fn from(e: LumenError) -> Self {
        tauri::ipc::InvokeError::from_anyhow(e.into())
    }
}

pub type Result<T> = std::result::Result<T, LumenError>;
