#include <napi.h>
#include <windows.h>

// WDA_EXCLUDEFROMCAPTURE = 0x00000011 (Windows 10 2004+)
#define WDA_EXCLUDEFROMCAPTURE 0x00000011

Napi::Value SetWindowDisplayAffinity(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto buf = info[0].As<Napi::Buffer<char>>();
  HWND hwnd = *reinterpret_cast<HWND*>(buf.Data());

  BOOL result = ::SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
  return Napi::Boolean::New(env, result == TRUE);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("setWindowDisplayAffinity",
    Napi::Function::New(env, SetWindowDisplayAffinity));
  return exports;
}

NODE_API_MODULE(ghost_addon, Init)
