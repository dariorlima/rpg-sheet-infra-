import * as cdk from '@aws-cdk/core';
import { RestApiPipeline } from '../constructors/RestApiPipeline';
import { Bucket } from '@aws-cdk/aws-s3';


export interface ApiProps {
  artifactsBucket: Bucket
}

export class RpgSheetApiConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props?: ApiProps) {
    super(scope, id);  

    new RestApiPipeline(this, 'RpgSheetApi', {
      github: {
        owner: 'dariorlima',
        repository: 'rpg-sheet-api'
      }
    });
  
  }
}
