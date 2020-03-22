#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RpgSheetInfraStack } from '../lib/rpg-sheet-infra-stack';

const app = new cdk.App();
new RpgSheetInfraStack(app, 'RpgSheetInfraStack');
