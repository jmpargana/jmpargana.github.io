resource "aws_route53_zone" "main" {
  name = "jmpargana.com"

  tags = {
    Name = "jmpargana.com"
  }
}

# GitHub Pages A Records (multiple IPs for same domain)
resource "aws_route53_record" "github_pages_a" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "jmpargana.com"
  type    = "A"
  ttl     = 3600
  records = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
  ]
}

# www CNAME to GitHub Pages
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.jmpargana.com"
  type    = "CNAME"
  ttl     = 3600
  records = ["jmpargana.github.io"]
}

# SES Domain Verification Record
resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_amazonses.jmpargana.com"
  type    = "TXT"
  ttl     = 1800
  records = [aws_ses_domain_identity.main.verification_token]
}

# DKIM Records (SES generates 3)
resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = aws_route53_zone.main.zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.jmpargana.com"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# SPF Record
resource "aws_route53_record" "spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "jmpargana.com"
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]
}

# DMARC Record
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.jmpargana.com"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=none; rua=mailto:postmaster@jmpargana.com"]
}

output "route53_nameservers" {
  value       = aws_route53_zone.main.name_servers
  description = "Nameservers to configure at Namecheap"
}

output "route53_zone_id" {
  value = aws_route53_zone.main.zone_id
}
