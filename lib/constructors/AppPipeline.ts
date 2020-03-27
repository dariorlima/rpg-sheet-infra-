import * as cdk from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import * as CodePipeline from '@aws-cdk/aws-codepipeline';
import * as CodePipelineAction from '@aws-cdk/aws-codepipeline-actions'
import * as CodeBuild from '@aws-cdk/aws-codebuild'

export interface PipelineProps {
    github: {
        owner: string
        repository: string
    }
}

export class AppPipeline extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: PipelineProps) {
        super(scope, id);

        /**
         * Creating a S3 Bucket to store the React Application
         */
        const bucket: Bucket = new Bucket(this, 'AppBucket', {
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'error.html',
            publicReadAccess: true,
        });

        /**
         * Set the Output artifacts
         */
        const outputSources = new CodePipeline.Artifact();
        const outputWebsite = new CodePipeline.Artifact();

        /**
         * Create a code pipeline to start the whole process
         * of up the application to AWS cloud
         */
        const pipeline = new CodePipeline.Pipeline(this, 'Pipeline', {
            pipelineName: 'Website',
            restartExecutionOnUpdate: true,
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
                    owner: props.github.owner,
                    repo: props.github.repository,
                    oauthToken: cdk.SecretValue.secretsManager('GitHubToken'),
                    output: outputSources,
                    trigger: CodePipelineAction.GitHubTrigger.WEBHOOK,
                }),
            ],
        });

        /**
         * Building the react application. 
         * It doesn't need a buildspec param because 
         * there is already a buildspec.yml in root of react app
         */
        pipeline.addStage({
            stageName: 'Build',
            actions: [
                // AWS CodePipeline action to run CodeBuild project
                new CodePipelineAction.CodeBuildAction({
                    actionName: 'BuildApp',
                    project: new CodeBuild.PipelineProject(this, 'BuildWebsite', {
                        projectName: 'RpgSheetApp',
                    }),
                    input: outputSources,
                    outputs: [outputWebsite],
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
                // AWS CodePipeline action to deploy CRA website to S3
                new CodePipelineAction.S3DeployAction({
                    actionName: 'AppDeploy',
                    input: outputWebsite,
                    bucket,
                }),
            ],
        })

        /**
         * Setting the output
         */
        new cdk.CfnOutput(this, 'AppBucketUrl', {
            value: bucket.bucketWebsiteUrl,
            description: 'Website URL',
        });

    }
}
