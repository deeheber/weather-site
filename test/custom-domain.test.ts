import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'

import { DomainStack } from '../lib/domain-stack'
import { WeatherSiteStack } from '../lib/weather-site-stack'

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

  test('Verify weather stack with custom domain no notifications', () => {
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
    template.resourceCountIs('AWS::CloudWatch::Alarm', 1)

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
    // Alternative approach - verify the alarm doesn't have AlarmActions property
    template.hasResourceProperties(
      'AWS::CloudWatch::Alarm',
      Match.not(Match.objectLike({ AlarmActions: Match.anyValue() })),
    )

    expect(template.toJSON()).toMatchSnapshot()
  })
})
