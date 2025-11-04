use std::path::PathBuf;

use napi::{ Task, bindgen_prelude::AsyncTask };
use napi_derive::napi;
use tree_magic_mini::{ match_filepath };

pub struct MatchPath {
    path: String,
    mime_type: String,
}

#[napi]
impl Task for MatchPath {
    type Output = bool;
    type JsValue = bool;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        Ok(match_filepath(&self.mime_type, &PathBuf::from(&self.path)))
    }

    fn resolve(&mut self, _: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi]
pub fn match_path(mime_type: String, path: String) -> AsyncTask<MatchPath> {
    AsyncTask::new(MatchPath { path, mime_type })
}
