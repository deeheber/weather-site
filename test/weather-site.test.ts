import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { AlertStack } from '../lib/alert-stack'
import { DomainStack } from '../lib/domain-stack'
import { WeatherSiteStack } from '../lib/weather-site-stack'

describe('Non-custom domain resources', () => {
  test('Verify weather stack resources', () => {
    const app = new App()
    const stack = new WeatherSiteStack(app, 'MyTestStack', {
      alertEmail: 'test@example.com',
      locationName: 'Test Location',
      openWeatherUrl: 'https://api.openweathermap.org/data/2.5/onecall',
      schedules: 'rate(10 minutes)'.split(', '),
      weatherLocationLat: '123',
      weatherLocationLon: '456',
      weatherType: 'snow',
    })
    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::S3::Bucket', 1)
    template.resourceCountIs('AWS::SSM::Parameter', 1)
    template.resourceCountIs('AWS::CloudFront::Distribution', 1)
    template.resourceCountIs('AWS::Events::Connection', 1)
    template.resourceCountIs('AWS::SNS::Topic', 1)
    template.resourceCountIs('AWS::SNS::Subscription', 1)

    template.hasResourceProperties('AWS::SNS::Subscription', {
      Endpoint: 'test@example.com',
      Protocol: 'email',
    })
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'MyTestStack-updateSiteFunction',
      Runtime: 'nodejs22.x',
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
      Target: {
        Input: JSON.stringify({
          WEATHER_TYPE: 'snow',
          WEATHER_LOCATION_LAT: '123',
          WEATHER_LOCATION_LON: '456',
          STACK_NAME: 'MyTestStack',
        }),
      },
    })

    expect(template.toJSON()).toMatchSnapshot()
  })

  test('Verify error alert stack resources', () => {
    const app = new App()
    const weatherStack = new WeatherSiteStack(app, 'TestWeatherStack', {
      alertEmail: 'test@example.com',
      locationName: 'Test Location',
      openWeatherUrl: 'https://api.openweathermap.org/data/2.5/onecall',
      schedules: 'rate(10 minutes)'.split(', '),
      weatherLocationLat: '123',
      weatherLocationLon: '456',
      weatherType: 'snow',
    })

    const alertStack = new AlertStack(app, 'TestAlertStack', {
      stepFunction: weatherStack.stepFunction,
      alertEmail: 'test@example.com',
    })
    const template = Template.fromStack(alertStack)

    template.resourceCountIs('AWS::SNS::Topic', 1)
    template.resourceCountIs('AWS::SNS::Subscription', 1)
    template.resourceCountIs('AWS::CloudWatch::Alarm', 1)

    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'TestAlertStack-error-topic',
      DisplayName: 'Weather Site Error Topic for TestAlertStack',
    })
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'test@example.com',
    })
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'TestAlertStack-alarm',
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      EvaluationPeriods: 1,
      Threshold: 2,
    })

    expect(template.toJSON()).toMatchSnapshot()
  })
})

describe('Custom domain resources', () => {
  test('Verify domain stack resources', () => {
    const app = new App()
    const domainName = 'mydomain.com'

    const domainStack = new DomainStack(app, 'TestDomainStack', {
      domainName,
    })
    const template = Template.fromStack(domainStack)

    template.resourceCountIs('AWS::Route53::HostedZone', 1)
    template.resourceCountIs('AWS::CertificateManager::Certificate', 2)
    template.resourceCountIs('AWS::CloudFront::Function', 1)
    template.resourceCountIs('AWS::CloudFront::Distribution', 1)
    template.resourceCountIs('AWS::Route53::RecordSet', 1)

    template.hasResourceProperties('AWS::Route53::HostedZone', {
      Name: 'mydomain.com.',
    })
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'mydomain.com',
    })
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'www.mydomain.com',
    })
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'www.mydomain.com.',
      Type: 'A',
    })

    expect(template.toJSON()).toMatchSnapshot()
  })

  test('Verify weather stack with custom domain', () => {
    const app = new App()
    const domainName = 'mydomain.com'

    const domainStack = new DomainStack(app, 'TestDomainStack', {
      domainName,
    })

    const weatherStack = new WeatherSiteStack(app, 'TestWeatherStack', {
      domainName,
      hostedZone: domainStack?.hostedZone,
      locationName: 'New York, NY USA',
      openWeatherUrl: 'https://api.openweathermap.org/data/2.5/onecall',
      schedules:
        'cron(0/30 * * 6-9 ? *), cron(0/10 * * 1,2,3,4,5,10,11,12 ? *)'.split(
          ', ',
        ),
      weatherLocationLat: '111',
      weatherLocationLon: '222',
      weatherType: 'rain',
    })
    const template = Template.fromStack(weatherStack)

    template.resourceCountIs('AWS::S3::Bucket', 1)
    template.resourceCountIs('AWS::SSM::Parameter', 1)
    template.resourceCountIs('AWS::CloudFront::Distribution', 1)
    template.resourceCountIs('AWS::Route53::RecordSet', 1)
    template.resourceCountIs('AWS::Events::Connection', 1)
    template.resourceCountIs('AWS::SNS::Topic', 0)
    template.resourceCountIs('AWS::SNS::Subscription', 0)

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'TestWeatherStack-updateSiteFunction',
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
    })
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineName: 'TestWeatherStack-state-machine',
      StateMachineType: 'EXPRESS',
      LoggingConfiguration: {
        Level: 'ALL',
      },
    })
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      Name: 'TestWeatherStack-schedule-0',
      ScheduleExpression: 'cron(0/30 * * 6-9 ? *)',
      Target: {
        Input: JSON.stringify({
          WEATHER_TYPE: 'rain',
          WEATHER_LOCATION_LAT: '111',
          WEATHER_LOCATION_LON: '222',
          STACK_NAME: 'TestWeatherStack',
        }),
      },
    })
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      Name: 'TestWeatherStack-schedule-1',
      ScheduleExpression: 'cron(0/10 * * 1,2,3,4,5,10,11,12 ? *)',
      Target: {
        Input: JSON.stringify({
          WEATHER_TYPE: 'rain',
          WEATHER_LOCATION_LAT: '111',
          WEATHER_LOCATION_LON: '222',
          STACK_NAME: 'TestWeatherStack',
        }),
      },
    })
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'mydomain.com.',
      Type: 'A',
    })

    expect(template.toJSON()).toMatchSnapshot()
  })
})
