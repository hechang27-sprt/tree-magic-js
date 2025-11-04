use napi::{ Task, bindgen_prelude::* };
use napi_derive::napi;
use tree_magic_mini::match_u8;

pub struct MatchBuffer {
    bytes: Buffer,
    mime_type: String,
}

#[napi]
impl Task for MatchBuffer {
    type Output = bool;
    type JsValue = bool;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        Ok(match_u8(&self.mime_type, &self.bytes))
    }

    fn resolve(&mut self, _: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi]
pub fn match_buffer(mime_type: String, bytes: Buffer) -> AsyncTask<MatchBuffer> {
    AsyncTask::new(MatchBuffer { bytes, mime_type })
}
