import { Stack, StackProps } from 'aws-cdk-lib'
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager'
import {
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
} from 'aws-cdk-lib/aws-cloudfront'
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { Construct } from 'constructs'

interface CertificateStackProps extends StackProps {
  domainName: string
}

export class CertificateStack extends Stack {
  public id: string
  public certificate: Certificate
  private domainName: string
  private hostedZone: HostedZone
  private redirectCertificate: Certificate

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props)
    this.id = id
    this.domainName = props.domainName

    this.createHostedZone()
    this.createCertificates()
    this.createRedirect()
  }

  private createHostedZone() {
    this.hostedZone = new HostedZone(this, `${this.id}-hosted-zone`, {
      zoneName: this.domainName,
    })
  }

  private createCertificates() {
    this.certificate = new Certificate(this, `${this.id}-cert`, {
      domainName: this.domainName,
      validation: CertificateValidation.fromDns(this.hostedZone),
    })

    this.redirectCertificate = new Certificate(this, `${this.id}-cert-www`, {
      domainName: `www.${this.domainName}`,
      validation: CertificateValidation.fromDns(this.hostedZone),
    })
  }

  private createRedirect() {
    /**
     * Redirect from www to non-www
     * AWS doesn't provide a nicer way to do this 👎🏻
     * Thanks to https://paramvirsingh.com/post/article/redirect-www-to-naked-domain-aws-cloudfront for this idea!
     *
     * www -> CloudFront Dist 1 -> CloudFront function redirect -> non-www -> CloudFront Dist 2
     */
    const redirectFunction = new Function(
      this,
      `${this.id}-redirect-function`,
      {
        code: FunctionCode.fromInline(`function handler(event) {
          console.log(event.request.headers);
          console.log(event.request);
          var response = {
              statusCode: 302,
              statusDescription: 'Found',
              headers: {
                  "location": { "value": 'https://${this.domainName}'+event.request.uri }    
              }
            }
          return response;
      }`),
        runtime: FunctionRuntime.JS_2_0,
      },
    )

    const redirectDistribution = new Distribution(
      this,
      `${this.id}-redirect-dist`,
      {
        defaultBehavior: {
          origin: new HttpOrigin(this.domainName),
          functionAssociations: [
            {
              function: redirectFunction,
              eventType: FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
        domainNames: [`www.${this.domainName}`],
        certificate: this.redirectCertificate,
      },
    )

    new ARecord(this, `${this.id}-a-record-www`, {
      zone: this.hostedZone,
      recordName: `www.${this.domainName}`,
      target: RecordTarget.fromAlias(
        new CloudFrontTarget(redirectDistribution),
      ),
    })
  }
}
