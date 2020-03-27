import * as cdk from '@aws-cdk/core';
import { RestApiPipeline } from '../constructors/RestApiPipeline';
import { Bucket } from '@aws-cdk/aws-s3';
import { Stream } from '@aws-cdk/aws-kinesis';
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose';
import { Role, ServicePrincipal, PolicyStatement, Effect, Policy } from '@aws-cdk/aws-iam';
import { CfnResource } from '@aws-cdk/core';

export interface ApiProps {
  artifactsBucket: Bucket
}

export class RpgSheetApiConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ApiProps) {
    super(scope, id);  

    const streamName: string = `rpg-sheet-data-stream`;

    const stream: Stream = new Stream(this, 'RpgSheetDataStream', {
      streamName,
      shardCount: 1,
    });

    const deliveryStreamRole: Role = new Role(this, 'DeliveryStreamRole', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com')
    });


    deliveryStreamRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions:[
        "kinesis:Get*",
        "kinesis:DescribeStream"
      ],
      resources: ['*']
    }))

    deliveryStreamRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions:[
        "kinesis:ListStreams*",
        "kinesis:DescribeStream"
      ],
      resources: ['*']
    }))


    const firehosePolicy = new Policy(this, 'FirehosePolicy', {
      roles: [deliveryStreamRole],
      statements: [
          new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [stream.streamArn],
              actions: ['kinesis:DescribeStream', 'kinesis:GetShardIterator', 'kinesis:GetRecords'],
          }),
      ],
    });

    const firehoseDeliveryStream = new CfnDeliveryStream(this, 'RpgSheetDeliveryStream', {
      deliveryStreamName: 'rpg-sheet-delivery-stream',
      deliveryStreamType: 'KinesisStreamAsSource',
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: stream.streamArn,
        roleArn: deliveryStreamRole.roleArn
      },
      extendedS3DestinationConfiguration: {
        bucketArn: props.artifactsBucket.bucketArn,
        roleArn: deliveryStreamRole.roleArn,
        bufferingHints: {
          sizeInMBs: 5,
          intervalInSeconds: 300
        },
        compressionFormat: 'ZIP'
      }
    })

    firehoseDeliveryStream.addDependsOn(firehosePolicy.node.defaultChild as CfnResource);

    new RestApiPipeline(this, 'RpgSheetApi', {
      github: {
        owner: 'dariorlima',
        repository: 'rpg-sheet-api'
      },
      artifactsBucket: props.artifactsBucket,
      stream
    });
  
  }
}
