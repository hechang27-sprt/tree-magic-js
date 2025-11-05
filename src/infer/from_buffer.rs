use napi::{
    bindgen_prelude::{AsyncTask, Buffer},
    JsString, JsStringLatin1, ScopedTask,
};
use napi_derive::napi;
use tree_magic_mini::from_u8;

pub struct InferFromBuffer {
    bytes: Buffer,
}

#[napi]
impl<'env> ScopedTask<'env> for InferFromBuffer {
    type Output = &'static str;
    type JsValue = JsString<'env>;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        Ok(from_u8(&self.bytes))
    }

    #[cfg(not(feature = "napi10"))]
    fn resolve(
        &mut self,
        env: &'env napi::Env,
        output: Self::Output,
    ) -> napi::Result<Self::JsValue> {
        env.create_string(output)
    }

    #[cfg(feature = "napi10")]
    fn resolve(
        &mut self,
        env: &'env napi::Env,
        output: Self::Output,
    ) -> napi::Result<Self::JsValue> {
        let js_str = JsStringLatin1::from_static(env, output)?; // mime strings are guaranteed to be Latin1
        Ok(js_str.into_value())
    }
}

#[napi]
pub fn infer_from_buffer(bytes: Buffer) -> AsyncTask<InferFromBuffer> {
    AsyncTask::new(InferFromBuffer { bytes })
}
