const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),babel=require('@babel/core');
const React=require('react');const {create,act}=require('react-test-renderer');globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function fixture(t){
  let focused=true,listener,resolvePermission,requests=0,renderer;
  const permission=new Promise(r=>resolvePermission=r);
  const file=path.resolve(__dirname,'../src/features/strength/TrackedStrengthScreen.js');
  const code=babel.transformFileSync(file,{babelrc:false,configFile:false,presets:[['babel-preset-expo',{lazyImports:false}]]}).code;
  const pass=({children})=>React.createElement(React.Fragment,null,children);
  const mocks={react:React,'react-native':{Platform:{OS:'ios'},Text:'Text',View:'View',AppState:{currentState:'active',addEventListener(name,fn){listener=fn;return{remove(){}};}},PermissionsAndroid:{}},'@react-navigation/native':{useIsFocused:()=>focused},'expo-modules-core':{requireOptionalNativeModule:()=>({requestPermission(){requests++;return permission;}}),requireNativeViewManager:()=> 'PoseView'},'./strengthTheme':{STRENGTH_TYPE:{title:{},body:{}},useStrengthStyles:()=>({styles:{}})},'./components/StrengthUI':{StrengthButton:props=>React.createElement('button',props,props.title),StrengthHeader:pass,StrengthNote:pass,StrengthScreenFrame:pass}};
  const module={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]||(name.startsWith('.')?require(path.resolve(path.dirname(file),name)):require(name)),module,module.exports);
  const props={exercise:{id:'bodyweight-squat',name:'Squat',defaultReps:8},sets:1,onComplete:async()=>{},onExit(){},onFallback(){}};
  act(()=>{renderer=create(React.createElement(module.exports.default,props));});t.after(()=>act(()=>renderer.unmount()));
  return {get requests(){return requests;},camera:()=>renderer.root.findAllByType('PoseView'),start(){return renderer.root.findByProps({title:'Start camera tracking (QA)'}).props.onPress();},state(value){act(()=>listener(value));},blur(){focused=false;act(()=>renderer.update(React.createElement(module.exports.default,{...props})));},resolve:resolvePermission};
}
test('native camera UI starts only after explicit permission and survives the iOS inactive prompt',async t=>{
  const f=fixture(t);assert.equal(f.camera().length,0);let pending;await act(async()=>{pending=f.start();});assert.equal(f.requests,1);f.state('inactive');assert.equal(f.camera().length,0);await act(async()=>{f.resolve(true);await pending;});assert.equal(f.camera().length,0,'camera must remain off while inactive');f.state('active');assert.equal(f.camera().length,1);f.state('background');assert.equal(f.camera().length,0);
});
test('native camera UI ignores a granted result after navigation away',async t=>{
  const f=fixture(t);let pending;await act(async()=>{pending=f.start();});f.blur();await act(async()=>{f.resolve(true);await pending;});assert.equal(f.camera().length,0);assert.equal(f.requests,1);
});
