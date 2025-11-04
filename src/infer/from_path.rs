use std::path::{ PathBuf };

use napi::{ JsString, JsStringLatin1, ScopedTask, bindgen_prelude::AsyncTask };
use napi_derive::napi;
use tree_magic_mini::from_filepath;

pub struct InferFromPath {
    path: String,
}

#[napi]
impl<'env> ScopedTask<'env> for InferFromPath {
    type Output = Option<&'static str>;
    type JsValue = Option<JsString<'env>>;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        let path = PathBuf::from(&self.path);
        Ok(from_filepath(&path))
    }

    #[cfg(not(feature = "napi10"))]
    fn resolve(&mut self, env: &'env napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        let js_str = output.map(env::create_string);
        Ok(js_str)
    }

    #[cfg(feature = "napi10")]
    fn resolve(&mut self, env: &'env napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        // mime strings are guaranteed to be Latin1
        let js_str = output.map(|s| JsStringLatin1::from_static(env, s).map(JsStringLatin1::into_value)).transpose()?;
        Ok(js_str)
    }
}

#[napi]
pub fn infer_from_path(path: String) -> AsyncTask<InferFromPath> {
    AsyncTask::new(InferFromPath { path })
}
