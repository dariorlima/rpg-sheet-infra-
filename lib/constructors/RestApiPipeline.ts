import * as cdk from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import * as CodePipeline from '@aws-cdk/aws-codepipeline';
import * as CodePipelineAction from '@aws-cdk/aws-codepipeline-actions'
import * as CodeBuild from '@aws-cdk/aws-codebuild';
import { Role, PolicyStatement, Effect, ServicePrincipal}from '@aws-cdk/aws-iam';
import { PipelineProject, BuildSpec, LinuxBuildImage, ComputeType, BuildEnvironmentVariableType } from '@aws-cdk/aws-codebuild';
import { CloudFormationCreateUpdateStackAction } from '@aws-cdk/aws-codepipeline-actions';
import { CloudFormationCapabilities } from '@aws-cdk/aws-cloudformation';
import { Stream } from '@aws-cdk/aws-kinesis';

export interface PipelineProps {
  github: {
    owner: string
    repository: string
  },
  artifactsBucket: Bucket,
  stream: Stream
}

export class RestApiPipeline extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: PipelineProps) {
    super(scope, id);

    const {
      github,
      artifactsBucket,
      stream
    } = props;

    /**
     * Creating a S3 Bucket to store the Api
     */
    const bucket: Bucket = new Bucket(this, 'ApiBucket', {
      bucketName: 'rpg-sheet-api-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      publicReadAccess: true,
    }); 

    const CodebuildRole: Role = new Role(this, 'CodebuildRole', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com')
    });

    CodebuildRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        's3:PutObject',
        'apigateway:*',
        'lambda:*',
        'dynamodb:Createtable',
        'cloudfront:CreateDistribution',
      ],
      resources: ['*']
    }));

    const CodeBuildProject: PipelineProject = new PipelineProject(this, 'CodeBuildProject', {
      buildSpec: BuildSpec.fromSourceFilename('buildspec.yml'),
      role: CodebuildRole,
      projectName: 'CodeBuildProject',
      environment: {
        buildImage: LinuxBuildImage.STANDARD_2_0,
        computeType: ComputeType.SMALL,
        privileged: true,
        environmentVariables: {
          BucketName: {
            type: BuildEnvironmentVariableType.PLAINTEXT,
            value: bucket.bucketName
          }
        }
      }
    });

    const SamDeploymentRole: Role = new Role(this, 'SamRole', {
      assumedBy: new ServicePrincipal('cloudformation.amazonaws.com')
    });

    SamDeploymentRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        's3:*',
        'lambda:*',
        'dynamodb:*',
        'apigateway:*',
        'events:*',
        'iam:*',
        'cloudformation:*',
        'kinesis:*',
        'firehose:*'
      ],
      resources:['*']
    }));

    const CodePipelineRole: Role = new Role(this, 'PipelineRole', {
      assumedBy: new ServicePrincipal('codepipeline.amazonaws.com')
    });

    CodePipelineRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'codebuild:BatchGetBuilds',
        'codebuild:StartBuild',
        'iam:PassRole',
        'cloudwatch:*',
        's3:*',
        'codepipeline:*',
        'cloudformation:*'
      ],
      resources: ['*']
    }));

    /**
     * Set the Output artifacts
     */
    const outputSources = new CodePipeline.Artifact('OutputSources');
    const outputBuild = new CodePipeline.Artifact('OutputBuild');

    /**
     * Create a code pipeline to start the whole process
     * of up the application to AWS cloud
     */
    const pipeline = new CodePipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'RpgSheetApiPipeline',
      role: CodePipelineRole,
      artifactBucket: artifactsBucket,
    });


    /**
     * Getting the source from github using secrets manager to get 
     * the token.
     */
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new CodePipelineAction.GitHubSourceAction({
          actionName: 'Checkout',
          owner: github.owner,
          repo: github.repository,
          oauthToken: cdk.SecretValue.secretsManager('GitHubToken'),
          output: outputSources,
          trigger: CodePipelineAction.GitHubTrigger.WEBHOOK,
          runOrder: 1
        }),
      ],
    });

    /**
     * Building the SAM. 
    */
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        // AWS CodePipeline action to run CodeBuild project
        new CodePipelineAction.CodeBuildAction({
          actionName: 'BuildAction',
          project: CodeBuildProject,
          input: outputSources,
          outputs: [outputBuild],
          runOrder: 1
        }),
      ],
    });

    /**
     * Deploying the whole application into the S3 Bucket 
     * created before.
     */
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
       new CloudFormationCreateUpdateStackAction({
         actionName: 'DeployAction',
         adminPermissions: true,
         stackName: 'RpgSheetApiStack',
         templatePath: outputBuild.atPath('sam_output.yml'),
         capabilities: [
           CloudFormationCapabilities.NAMED_IAM,
           CloudFormationCapabilities.AUTO_EXPAND,
         ],
         replaceOnFailure: true,
         deploymentRole: SamDeploymentRole,
         parameterOverrides: {
          Stream: stream.streamArn
         }
       })
      ],
    })

    /**
     * Setting the output
     */
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: bucket.bucketWebsiteUrl,
      description: 'Api URL',
    });
  }
}