import {Camera} from 'expo-camera';
import type {CameraPermissionProvider,CameraPermissionStatus} from './poseAdapter';

function permissionStatus(permission:{granted:boolean;canAskAgain:boolean;status:string}):CameraPermissionStatus {
  if(permission.granted) return 'GRANTED';
  if(!permission.canAskAgain) return 'BLOCKED';
  return permission.status==='undetermined'?'UNDETERMINED':'DENIED';
}
export const cameraPermissions:CameraPermissionProvider={
  getStatus:async()=>permissionStatus(await Camera.getCameraPermissionsAsync()),
  request:async()=>permissionStatus(await Camera.requestCameraPermissionsAsync()),
};
