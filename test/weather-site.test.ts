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

  expect(template.toJSON()).toMatchSnapshot()
})

test('Verify resources are created with custom domain', () => {
  const app = new App()
  const stack = new WeatherSiteStack(app, 'CustomDomainStack', {
    domainName: 'mydomain.com',
    locationName: 'New York, NY USA',
    openWeatherUrl: 'https://api.openweathermap.org/data/2.5/onecall',
    schedules:
      'cron(0/30 * * 6-9 ? *), cron(0/10 * * 1,2,3,4,5,10,11,12 ? *)'.split(
        ', ',
      ),
    secretsExtensionArn: 'secret-extension-arn',
    weatherLocationLat: '111',
    weatherLocationLon: '222',
    weatherSecretArn: 'weather-secret-arn',
    weatherType: 'rain',
  })
  const template = Template.fromStack(stack)

  template.resourceCountIs('AWS::S3::Bucket', 1)
  template.resourceCountIs('AWS::SSM::Parameter', 1)
  template.resourceCountIs('AWS::CloudFront::Distribution', 2)
  template.resourceCountIs('AWS::Route53::RecordSet', 2)
  template.resourceCountIs('AWS::CloudFront::Function', 1)

  template.hasResourceProperties('AWS::CertificateManager::Certificate', {
    DomainName: 'mydomain.com',
  })
  template.hasResourceProperties('AWS::CertificateManager::Certificate', {
    DomainName: 'www.mydomain.com',
  })
  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'CustomDomainStack-checkCurrentWeather',
    Runtime: 'nodejs20.x',
    Architectures: ['arm64'],
  })
  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'CustomDomainStack-updateSiteFunction',
    Runtime: 'nodejs20.x',
    Architectures: ['arm64'],
  })

  template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
    StateMachineName: 'CustomDomainStack-state-machine',
    StateMachineType: 'EXPRESS',
    LoggingConfiguration: {
      Level: 'ALL',
    },
  })
  template.hasResourceProperties('AWS::Scheduler::Schedule', {
    Name: 'CustomDomainStack-schedule-0',
    ScheduleExpression: 'cron(0/30 * * 6-9 ? *)',
  })
  template.hasResourceProperties('AWS::Scheduler::Schedule', {
    Name: 'CustomDomainStack-schedule-1',
    ScheduleExpression: 'cron(0/10 * * 1,2,3,4,5,10,11,12 ? *)',
  })

  expect(template.toJSON()).toMatchSnapshot()
})
