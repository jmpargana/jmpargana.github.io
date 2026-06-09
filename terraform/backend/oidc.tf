# GitHub OIDC Provider
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

# Role for GitHub Actions to assume
data "aws_iam_policy_document" "github_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    actions = ["sts:AssumeRoleWithWebIdentity"]
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      # Restrict to main branch only. Change repo name & branch as needed
      values = ["repo:jmpargana/jmpargana:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_broadcast" {
  name               = "github-broadcast-newsletter-role"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json
}

# Policy to invoke broadcast lambda only
data "aws_iam_policy_document" "github_broadcast_invoke" {
  statement {
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.broadcast.arn]
  }
}

resource "aws_iam_policy" "github_broadcast_invoke" {
  name   = "github-broadcast-invoke-policy"
  policy = data.aws_iam_policy_document.github_broadcast_invoke.json
}

resource "aws_iam_role_policy_attachment" "github_broadcast" {
  role       = aws_iam_role.github_broadcast.name
  policy_arn = aws_iam_policy.github_broadcast_invoke.arn
}

output "github_broadcast_role_arn" {
  value = aws_iam_role.github_broadcast.arn
}

output "broadcast_lambda_name" {
  value = aws_lambda_function.broadcast.function_name
}
