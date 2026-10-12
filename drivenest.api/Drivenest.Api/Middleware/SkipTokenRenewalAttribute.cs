namespace Drivenest.Api.Middleware
{
    [AttributeUsage(AttributeTargets.Method)]
    public class SkipTokenRenewalAttribute : Attribute
    {
    }
}
