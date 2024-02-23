import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { WeatherSiteStack } from '../lib/weather-site-stack'

test('Verify resources are created', () => {
  const app = new App()
  const stack = new WeatherSiteStack(app, 'MyTestStack', {
    domainName: '',
    locationName: 'Test Location',
    openWeatherUrl: 'https://api.openweathermap.org/data/2.5/onecall',
    schedules: 'rate(10 minutes)'.split(', '),
    secretsExtensionArn: 'secret-extension-arn',
    weatherLocationLat: '123',
    weatherLocationLon: '456',
    weatherSecretArn: 'weather-secret-arn',
    weatherType: 'rain',
  })
  const template = Template.fromStack(stack)

  template.resourceCountIs('AWS::S3::Bucket', 1)
  template.resourceCountIs('AWS::SSM::Parameter', 1)
  template.resourceCountIs('AWS::CloudFront::Distribution', 1)

  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'MyTestStack-checkCurrentWeather',
    Runtime: 'nodejs20.x',
    Architectures: ['arm64'],
  })
  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'MyTestStack-updateSiteFunction',
    Runtime: 'nodejs20.x',
    Architectures: ['arm64'],
  })

  template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
    StateMachineName: 'MyTestStack-state-machine',
    StateMachineType: 'EXPRESS',
    LoggingConfiguration: {
      Level: 'ALL',
    },
  })
  template.hasResourceProperties('AWS::Scheduler::Schedule', {
    Name: 'MyTestStack-schedule-0',
    ScheduleExpression: 'rate(10 minutes)',
  })
})
