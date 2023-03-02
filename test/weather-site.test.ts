import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { WeatherSiteStack } from '../lib/weather-site-stack'

test('Verify resources are created', () => {
  const app = new App()
  const stack = new WeatherSiteStack(app, 'MyTestStack')
  const template = Template.fromStack(stack)

  template.resourceCountIs('AWS::S3::Bucket', 1)
  template.resourceCountIs('AWS::DynamoDB::Table', 1)

  template.hasResourceProperties('AWS::S3::Bucket', {
    WebsiteConfiguration: {
      IndexDocument: 'index.html',
    },
  })
  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'checkCurrentWeatherFunction',
    Runtime: 'nodejs18.x',
    Architectures: ['arm64'],
  })
  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'updateSiteFunction',
    Runtime: 'nodejs18.x',
    Architectures: ['arm64'],
  })

  template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
    StateMachineName: 'WeatherSiteStateMachine',
    StateMachineType: 'EXPRESS',
    LoggingConfiguration: {
      Level: 'ALL',
    },
  })
  template.hasResourceProperties('AWS::Scheduler::Schedule', {
    Name: 'WeatherSiteScheduler',
    ScheduleExpression: 'rate(10 minutes)',
  })
})
