#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RpgSheetStack } from '../lib';


const app = new cdk.App();

new RpgSheetStack(app, 'RpgSheetApiInfraStack');
