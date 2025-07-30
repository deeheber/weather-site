import { Duration, Stack, StackProps } from 'aws-cdk-lib'
import { Alarm, ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch'
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions'
import { Construct } from 'constructs'

interface AlertStackProps extends StackProps {
  alertEmail: string
  stepFunction: StateMachine
}

export class AlertStack extends Stack {
  public id: string

  constructor(scope: Construct, id: string, props: AlertStackProps) {
    super(scope, id, props)

    this.id = id
    const { alertEmail, stepFunction } = props

    // Create SNS Topic
    const topicName = `${this.id}-error-topic`
    const errorTopic = new Topic(this, topicName, {
      topicName,
      displayName: `Weather Site Error Topic for ${this.id}`,
    })
    errorTopic.addSubscription(
      new EmailSubscription(alertEmail, {
        json: false,
      }),
    )

    // Create Cloudwatch Alarm
    const threshold = 2
    const evaluationPeriods = 1
    const period = 1
    const metric = stepFunction.metricFailed({
      period: Duration.hours(period),
    })

    const alarmName = `${this.id}-alarm`
    const alarm = new Alarm(this, alarmName, {
      actionsEnabled: true,
      alarmName,
      alarmDescription: `Alarm (${alarmName}) if the SUM of errors is greater than or equal to the threshold (${threshold}) for ${evaluationPeriods} evaluation period of ${period} minutes`,
      metric,
      threshold,
      evaluationPeriods,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    })

    alarm.addAlarmAction(new SnsAction(errorTopic))
  }
}
