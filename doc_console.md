> For the complete documentation index, see [llms.txt](https://docs.portainer.io/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.portainer.io/user/docker/containers/console.md).

# Access a container's console

From the menu select **Containers**, select the container then select **Console**.

<figure><img src="/files/thiFqwZ6XYonDSPmrNm4" alt=""><figcaption></figcaption></figure>

Select the command and the user you want to give access to, then click **Connect**.

{% hint style="info" %}
For Alpine Linux containers, you must select the`/bin/ash` command.
{% endhint %}

<figure><img src="/files/lVJosIwHd4I0n7ep8ZtL" alt=""><figcaption></figcaption></figure>

If you need to define a command other than those provided, toggle the **Use custom command** option on. Once connected, you can run commands in the console the same as any other Linux system.

<figure><img src="/files/0WGX71jHDbkfL9d7dL43" alt=""><figcaption></figcaption></figure>

To disconnect from the console session, click the **Disconnect** button.
