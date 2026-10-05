use std::fs;
use std::path::{Path, PathBuf};

/// Returns the icon cache directory, creating it if needed.
/// Uses the system temp dir to avoid triggering Tauri's file watcher.
pub fn icon_cache_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("lumen_icon_cache");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Find the "main" executable inside a directory — picks the largest .exe.
pub fn find_main_exe(dir: &Path) -> Option<PathBuf> {
    let mut exes: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().map_or(false, |e| e == "exe") {
                exes.push(p);
            }
        }
    }
    // Sort by file size descending — the main game exe is usually the largest
    exes.sort_by(|a, b| {
        let sa = fs::metadata(a).map(|m| m.len()).unwrap_or(0);
        let sb = fs::metadata(b).map(|m| m.len()).unwrap_or(0);
        sb.cmp(&sa)
    });
    exes.into_iter().next()
}

/// Extract a hi-res (256×256 jumbo) icon from an .exe file via a PowerShell
/// helper script that uses the Windows Shell image list API. Results are
/// cached to disk as `.txt` files so subsequent scans are instant.
pub fn extract_exe_icon(exe_path: &str, cache_key: &str) -> Option<String> {
    let safe_key = cache_key
        .replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    let cache_file = icon_cache_dir().join(format!("{}.txt", safe_key));

    // Fast-path: return cached data-URL
    if cache_file.exists() {
        if let Ok(data) = fs::read_to_string(&cache_file) {
            let data = data.trim().to_string();
            if data.starts_with("data:image") {
                return Some(data);
            }
        }
    }

    // Ensure the PowerShell helper script exists
    let script_path = icon_cache_dir().join("extract_icon.ps1");
    if !script_path.exists() {
        write_icon_script(&script_path);
    }

    // Run the script
    let output = std::process::Command::new("powershell")
        .arg("-NoProfile")
        .arg("-NoLogo")
        .arg("-NonInteractive")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-File")
        .arg(&script_path)
        .arg(exe_path)
        .output()
        .ok()?;

    let b64 = String::from_utf8(output.stdout)
        .ok()?
        .trim()
        .to_string();

    if b64.is_empty() || b64.len() < 20 {
        return None;
    }

    let data_url = format!("data:image/png;base64,{}", b64);

    // Cache to disk
    let _ = fs::write(&cache_file, &data_url);

    Some(data_url)
}

/// Write the PowerShell icon-extraction helper to disk.
fn write_icon_script(path: &Path) {
    let script = [
        "param([string]$ExePath)",
        "Add-Type -AssemblyName System.Drawing",
        "",
        "# Build inline C# type for jumbo (256x256) icon extraction",
        "$cs = @'",
        "using System;",
        "using System.Drawing;",
        "using System.Runtime.InteropServices;",
        "",
        "public class JumboIconExtractor {",
        "    [DllImport(\"shell32.dll\", EntryPoint = \"#727\")]",
        "    private static extern int SHGetImageList(int iImageList, ref Guid riid, ref IntPtr ppv);",
        "",
        "    [DllImport(\"shell32.dll\", CharSet = CharSet.Auto)]",
        "    private static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbSizeFileInfo, uint uFlags);",
        "",
        "    [DllImport(\"comctl32.dll\", SetLastError = true)]",
        "    private static extern IntPtr ImageList_GetIcon(IntPtr himl, int i, int flags);",
        "",
        "    [DllImport(\"user32.dll\")]",
        "    public static extern bool DestroyIcon(IntPtr hIcon);",
        "",
        "    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]",
        "    private struct SHFILEINFO {",
        "        public IntPtr hIcon;",
        "        public int iIcon;",
        "        public uint dwAttributes;",
        "        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]",
        "        public string szDisplayName;",
        "        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]",
        "        public string szTypeName;",
        "    }",
        "",
        "    public static Bitmap GetIcon(string filePath) {",
        "        SHFILEINFO shfi = new SHFILEINFO();",
        "        SHGetFileInfo(filePath, 0, ref shfi, (uint)Marshal.SizeOf(typeof(SHFILEINFO)), 0x4000);",
        "",
        "        Guid iid = new Guid(\"46EB5926-582E-4017-9FDF-E8998DAA0950\");",
        "        IntPtr hImgList = IntPtr.Zero;",
        "        SHGetImageList(4, ref iid, ref hImgList);",
        "",
        "        if (hImgList != IntPtr.Zero) {",
        "            IntPtr hIcon = ImageList_GetIcon(hImgList, shfi.iIcon, 0);",
        "            if (hIcon != IntPtr.Zero) {",
        "                Icon ico = (Icon)Icon.FromHandle(hIcon).Clone();",
        "                DestroyIcon(hIcon);",
        "                return ico.ToBitmap();",
        "            }",
        "        }",
        "",
        "        Icon fb = Icon.ExtractAssociatedIcon(filePath);",
        "        if (fb != null) return fb.ToBitmap();",
        "        return null;",
        "    }",
        "}",
        "'@",
        "",
        "Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Drawing",
        "",
        "try {",
        "    $bmp = [JumboIconExtractor]::GetIcon($ExePath)",
        "    if ($bmp) {",
        "        $ms = New-Object System.IO.MemoryStream",
        "        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)",
        "        [Convert]::ToBase64String($ms.ToArray())",
        "        $ms.Dispose()",
        "        $bmp.Dispose()",
        "    }",
        "} catch {",
        "    try {",
        "        $i = [System.Drawing.Icon]::ExtractAssociatedIcon($ExePath)",
        "        if ($i) {",
        "            $b = $i.ToBitmap()",
        "            $ms = New-Object System.IO.MemoryStream",
        "            $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)",
        "            [Convert]::ToBase64String($ms.ToArray())",
        "            $ms.Dispose()",
        "            $b.Dispose()",
        "            $i.Dispose()",
        "        }",
        "    } catch {}",
        "}",
    ].join("\n");
    let _ = fs::write(path, script);
}

/// Convenience: given a game directory OR direct exe path, extract its icon.
pub fn icon_for_path(path: &str, cache_key: &str) -> Option<String> {
    let p = Path::new(path);
    if p.is_file() && p.extension().map_or(false, |e| e == "exe") {
        // Path is already an .exe
        return extract_exe_icon(path, cache_key);
    }
    if p.is_dir() {
        // Find the main exe in the directory
        if let Some(exe) = find_main_exe(p) {
            return extract_exe_icon(&exe.to_string_lossy(), cache_key);
        }
    }
    None
}