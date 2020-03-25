import * as cdk from '@aws-cdk/core';
import { AppPipeline } from '../constructors/AppPipeline';

export class RpgSheetAppConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);  

    new AppPipeline(this, 'RpgSheetApp',{
      github: {
        owner: 'dariorlima',
        repository: 'rpg-sheet'
      }
    });
  }
}
