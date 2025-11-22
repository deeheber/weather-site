import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { WeatherSiteStack } from '../lib/weather-site-stack'

describe('Weather stack with notifications', () => {
  test('Verify weather stack resources with notifications', () => {
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

    template.resourceCountIs('AWS::SNS::Topic', 1)
    template.resourceCountIs('AWS::SNS::Subscription', 1)
    template.resourceCountIs('AWS::S3::Bucket', 1)
    template.resourceCountIs('AWS::SSM::Parameter', 1)
    template.resourceCountIs('AWS::CloudFront::Distribution', 1)
    template.resourceCountIs('AWS::Events::Connection', 1)
    template.resourceCountIs('AWS::CloudWatch::Alarm', 1)
    template.resourceCountIs('AWS::Scheduler::Schedule', 1)

    template.hasResourceProperties('AWS::SNS::Subscription', {
      Endpoint: 'test@example.com',
      Protocol: 'email',
    })
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'MyTestStack-updateSiteFunction',
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
    })
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineName: 'MyTestStack-state-machine',
      StateMachineType: 'EXPRESS',
      LoggingConfiguration: {
        Level: 'ALL',
      },
    })
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'ExecutionsFailed',
      Namespace: 'AWS/States',
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
})
