import * as cdk from '@aws-cdk/core';
import { RpgSheetApiConstruct  } from './api';
import { RpgSheetAppConstruct } from './app';
import { Bucket } from '@aws-cdk/aws-s3';

export class RpgSheetStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);  

    const artifactsBucket: Bucket = new Bucket(this, 'ArtifactsBucket');

    new RpgSheetApiConstruct(this, 'RpgSheetApi', {
        artifactsBucket
    });
    
    new RpgSheetAppConstruct(this, 'RpgSheetApp');
  
  }
}
